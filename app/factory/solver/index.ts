import { useEffect, useRef, useState } from 'react';

import Highs, { type Highs as HighsType } from "highs";
import type { CustomNodeType } from '../graph/nodes';
import type { CustomEdgeType } from '../graph/edges';
import { loadProductData, loadRecipeData, type Product, type ProductId, type Recipe } from '../graph/loadJsonData';

export type EqualityTypes = "eq" | "gt" | "lt";

export default class Solver {
  constructor(highs: HighsType) {
    // Initialize the solver here if needed
    console.log("Solver initialized with Highs", highs);
  }
}

const recipeData = loadRecipeData();

const defaultUrl = "https://lovasoa.github.io/highs-js/";
export const useHighs = () => {

  const url = useRef('');
  const [highs, setHighs] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async (url: string) => {
    console.log("Loading Highs from", url);
    return await Highs({ locateFile: (file: string) => url + file });
  }

  useEffect(() => {
    console.log("useHighs effect", url.current, defaultUrl);
    if (url.current !== defaultUrl) {
      setLoading(true);
      url.current = defaultUrl;
      load(defaultUrl)
        .then(exports => setHighs(exports))
        .finally(() => setLoading(false))
    }
  }, [defaultUrl]);
  return { highs, loading };
}


/** Hold a list of nodes this node connects to via edges
```
  nodeId: {
    recipe: Recipe Data
    inputs: {
      water: [{ sourceNodeId, edgeId }]
    },
    outputs: {
      steam: [{targetNodeId, edgeId}]
    }
  }
```
*/
export type NodeConnection = {
  recipe: Recipe,
  inputs: {
    [k in ProductId]?: { nodeId: string, edgeId: string }[]
  },
  outputs: {
    [k in ProductId]?: { nodeId: string, edgeId: string }[]
  }
};
export type NodeConnections = Record<string, NodeConnection>;
export type OpenConnections = {
  inputs: { [k in ProductId]?: string[] },
  outputs: { [k in ProductId]?: string[] }
}

export const buildNodeConnections = (nodes: CustomNodeType[], edges: CustomEdgeType[]) => {
  // TODO:: Graph walking to find seperate graphs. Not supported for now.

  let nodesById: Record<string, CustomNodeType> = {};

  const nodeRecipe = {} as Record<string, Recipe>;

  const nodeConnections: NodeConnections = {};
  const openConnections: OpenConnections = {
    inputs: {},
    outputs: {},
  };

  const nodeOrder = {} as Record<string, number>;
  nodes.forEach((node, index) => {
    nodesById[node.id] = node;
    nodeOrder[node.id] = index;
    nodeRecipe[node.id] = recipeData[node.data.recipeId];
    const inputs: NodeConnection["inputs"] = {};
    const outputs: NodeConnection["outputs"] = {};

    nodeRecipe[node.id].inputs.forEach(product => {
      inputs[product.id] = [];
      (openConnections.inputs[product.id] ||= []).push(node.id)
    });

    nodeRecipe[node.id].outputs.forEach(product => {
      outputs[product.id] = [];
      (openConnections.outputs[product.id] ||= []).push(node.id)
    });

    nodeConnections[node.id] = {
      recipe: recipeData[node.data.recipeId],
      inputs: inputs,
      outputs: outputs,
    };
  });

  edges.forEach(edge => {
    const productId = edge.targetHandle as ProductId;

    // Some sanity checks first
    if (!productId) {
      console.error("Item error on node", edge.target);
      throw new Error("No item found on node");
    }

    if (edge.targetHandle !== edge.sourceHandle) {
      console.error("Error matching source", edge.sourceHandle, "and target", edge.targetHandle);
      throw new Error("Source and Target type do not match, something is wrong");
    }

    (nodeConnections[edge.target].inputs[productId] ||= []).push({ nodeId: edge.source, edgeId: edge.id });
    (nodeConnections[edge.source].outputs[productId] ||= []).push({ nodeId: edge.target, edgeId: edge.id });

    // Update open connections list so we know this Product is connected to something
    if (openConnections.inputs[productId] !== undefined) {
      openConnections.inputs[productId] = openConnections.inputs[productId].filter(n => n != edge.target)
      if (openConnections.inputs[productId].length === 0)
        delete openConnections.inputs[productId];
    }
    if (openConnections.outputs[productId] !== undefined) {
      openConnections.outputs[productId] = openConnections.outputs[productId]?.filter(n => n != edge.source)
      if (openConnections.outputs[productId]?.length === 0)
        delete openConnections.outputs[productId];
    }
  });

  return { nodeConnections, openConnections };
}

export type FactoryGoal = {
  productId: ProductId,
  qty: number,
  type: "eq" | "lt" | "gt",
  dir: "input" | "output"
};

const debugLog = true;
const debug = (...args: any[]) => {
  if (debugLog)
    console.debug(...args);
}

// Every constraint needs to know what to add and subtract, what item it's for and which nodes they came from
// The constraint "label" in LPP will be the item (+ a uniq), while the nodes will be the variables (the recipe / building)
type Constraint = {
  id: string,
  productId: ProductId,
  edges: Set<string>,
  type: EqualityTypes,
  unconnected: boolean,
  terms: ({
    nodeId?: string,
    id: string,
    term: string,
  })[],
};

export const buildLpp = (nodeConnections: NodeConnections, openConnections: OpenConnections, goals: FactoryGoal[]) => {
  // To build a constraint for an item we need to know all the usages that are linked together. 
  // For simple a->b paths that is a - b = 0
  // For one to many paths a->[b,c] that is a - b - c = 0

  const constraints: Map<string, Constraint> = new Map();

  // Get an LPP appropriate label for a node ID. They can't be long or contain some chars
  // They need a consistent label among all terms though so it needs storing somewhere
  const nodeIdToLabels = {} as Record<string, string>;
  let nodeLabelInc = 0;
  const getNodeLabel = (node: string) => (nodeIdToLabels[node] ||= "n_" + nodeLabelInc++, nodeIdToLabels[node]);

  const getTerm = (nodeId: string, productId: ProductId, isInput: boolean): Constraint["terms"][0] | null => {
    const ioString = isInput ? "inputs" : "outputs";

    const recipeQty = nodeConnections[nodeId].recipe[ioString].find(p => productId == p.id)?.quantity
    if (!recipeQty) {
      console.error('Could not find recipe quantity for', productId, 'as', ioString, 'on', nodeId);
      return null;
    }

    return {
      id: getNodeLabel(nodeId),
      nodeId: nodeId,
      term: (isInput ? "-" : "+") + recipeQty
    };
  }

  /**
   * Open items in the graph need a meta constraint that binds all their inputs / outputs into one final variable.
   * This is build over time and stored in itemConstraints for reference later
   */
  const upsertConstraint = (id: string, productId: ProductId) => {
    let constraint: Constraint | undefined = constraints.get(id);
    if (!constraint) {
      constraint = {
        terms: [],
        id: id,
        edges: new Set<string>(), // These item "meta" constraints should never have edges, by definition.
        productId: productId,
        // Item sinks should balance to zero.
        // This lets the sink variable expose what is required to acheive balance
        type: "eq",
        unconnected: false,
      };

      // Add a sink for this constraint for problem solving later. They are pinned to 0 by default.
      // This term is negated compared to the others so that the sink can balance 
      // the ins/outs of this constraint back to 0.  
      constraint.terms.push({
        id: id,
        term: "-"
      });

      constraints.set(id, constraint);
      debug('Added new item constraint for', productId, constraint)
    }

    return constraint;
  }

  const visitedVertices: Set<string> = new Set();
  const makeVertexId = (node: string, io: string, product: string) => {
    return `${node}/${io}/${product}`
  }  

  const itemConstraints: {
    [k in ProductId]?: string
  } = {};

  /** 
   * Some terms:
   * Node - A box on the graph, almost always a Recipe Node (others planned)
   * Vertex - A single input / output product on a node,
   * Edge - A connection between vertices
   * "NodeConnections" / "Connections" a graph structure built from nodes & edges
   * 
   * 3 ways this can go
   * 
   * 1. 0 connections
   *   !! add to open item constraint
   * 
   * 2. only 1 connection
   *     other side has 1 connection
   *      !! add = 0 constraint
   *     other side has many
   *       run again for other side ( will skip to 3.)
   * 3. many connections
   *     is only part of the loop (otherside also has many connections)
   *       !! add < or > constraint
   *       !! add flag for loop finding later on
   *     is whole closed loop
   *       !! add = 0 constraint
  */
  const addDirectConstraints = (nodeId: string, productId: ProductId, isInput: boolean, groupConstraintId: string | null = null) => {

    const ioString = isInput ? "inputs" : "outputs";
    const ioStringOpp = isInput ? "outputs" : "inputs"

    const vertextId = makeVertexId(nodeId, ioString, productId);
    // We've seen this before
    if (visitedVertices.has(vertextId)) { debug('Skipping vertex', vertextId); return; }
    visitedVertices.add(vertextId);
    debug('Processing vertex', vertextId);

    const connections = nodeConnections[nodeId]?.[ioString][productId];
    const myTerm = getTerm(nodeId, productId, isInput);
    if (!myTerm) return;

    // No connections means it's an open input/output
    // These are collated across all graphs for matching goals and reporting by-products and input needs
    if (!connections || connections?.length == 0) {
      debug('Open Item', vertextId);
      const itemConstraintId = ioString.slice(0,1) + "_" + productId;
      const constraint = upsertConstraint(itemConstraintId, productId);
      itemConstraints[productId] = itemConstraintId;

      constraint.unconnected = true;
      constraint.terms.push(myTerm);
      return;
    }

    const oppositeConnections = nodeConnections[connections[0].nodeId][ioStringOpp][productId];
    if (oppositeConnections === undefined) return;

    // If we only have 1 connection it's either a closed 1-1, OR our neighbour has many
    // If it's a 1-1 it should balance to 0,
    // otherwise it needs to be loose
    if (connections.length == 1) {
      const constraint = upsertConstraint(`c${constraintIdInc++}`, productId);
      constraint.terms.push(myTerm);

      const otherTerm = getTerm(connections[0].nodeId, productId, !isInput);
      if (otherTerm) constraint.terms.push(otherTerm);
      constraint.edges.add(connections[0].edgeId);

      if (oppositeConnections.length > 1) {
        constraint.type = isInput ? "gt" : "lt";

        debug("I have 1 connection, they have more");
        addDirectConstraints(connections[0].nodeId, productId, !isInput);
      }
      return;
    }

    let groupConstraint: Constraint | null = null;
    // A group constraint is required if we're part of a larger loop
    // If an ID was passed in, continue with that one, 
    // otherwise check if one is needed and make it, then pass it around
    if (groupConstraintId) {
      debug('Using GROUP constraint', groupConstraintId);
      groupConstraint = upsertConstraint(groupConstraintId, productId);
    } else {
      // Check all my connections, if they have more than 1, start a group chat (constraint)      
      if (connections.some(conn => (nodeConnections[conn.nodeId][ioStringOpp][productId] || []).length > 1)) {
        groupConstraintId = `c_${productId}_${constraintIdInc++}`;
        debug('Creating GROUP constraint', groupConstraintId);
        groupConstraint = upsertConstraint(groupConstraintId, productId);
        groupConstraint.terms.push(myTerm);
        groupConstraint.type = "eq";
      }
    }

    const myConstraint = upsertConstraint(`c${constraintIdInc++}`, productId);
    myConstraint.terms.push(myTerm);

    // If there's a larger constraint this one should be variable
    if (groupConstraint) myConstraint.type = isInput ? "gt" : "lt";

    connections.forEach(conn => {
      const term = getTerm(conn.nodeId, productId, !isInput);

      myConstraint?.edges.add(conn.edgeId);
      groupConstraint?.edges.add(conn.edgeId);

      if (groupConstraint && term) {
        const otherVertex = makeVertexId(conn.nodeId, ioStringOpp, productId);
        // Only add the term if the other vertex hasn't ran through processing
        if (!visitedVertices.has(otherVertex)) {
          debug("adding term to group", term);
          groupConstraint?.terms.push(term);
        }
      }

      if (term) myConstraint?.terms.push(term);

      addDirectConstraints(conn.nodeId, productId, !isInput, groupConstraintId);
    });
  }

  // Loop all the inputs and outputs found in nodeConnections 
  let constraintIdInc = 0;
  for (const nodeId of Object.keys(nodeConnections)) {
    for (const productId of Object.keys(nodeConnections[nodeId].inputs) as ProductId[]) {
      addDirectConstraints(nodeId, productId, true);
    }

    for (const productId of Object.keys(nodeConnections[nodeId].outputs) as ProductId[]) {
      addDirectConstraints(nodeId, productId, false);
    }
  }

  const getEquality = (type: EqualityTypes) => {
    switch (type) {
      case "eq":
        return "=";
      case "gt":
        return ">=";
      case "lt":
        return "<=";
    }
  }
  const objectives = Object.values(nodeIdToLabels);
  let boundsList = [];
  let constraintsList = [];
  for (const con of constraints.values()) {
    constraintsList.push(`${con.id}: ${con.terms.map(t => `${t.term} ${t.id}`).join(' ')} ${getEquality(con.type)} 0`);

    // // If this product is a goal, it will have a bound set elsewhere
    // if (goals.findIndex(g => g.productId == con.productId) !== -1)
    //   continue;

    if (con.unconnected)
      boundsList.push(`${con.id} free`);
    else
      boundsList.push(`${con.id} = 0`);
  };

  // Keep track of missed goals to flag them
  const missedGoals: string[] = [];
  boundsList.push(...goals.map(g => {
    if (itemConstraints[g.productId] === undefined) {
      missedGoals.push(g.productId);
      return
    }
    return `${itemConstraints[g.productId]} ${g.type == "lt" ? "<=" : g.type == "gt" ? ">=" : "="} ${g.qty}`
  }))

  let lpp = `
min
  obj: ${objectives.join('+')}
subject to 
  ${constraintsList.join("\n")}
Bounds 
  ${boundsList.join("\n")}
end`;

  return { constraints, lpp, nodeIdToLabels, missedGoals };
}

