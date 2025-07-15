import { useEffect, useRef, useState } from 'react';

import Highs, { type Highs as HighsType } from "highs";
import type { CustomNodeType } from '../graph/nodes';
import type { CustomEdgeType } from '../graph/edges';
import { loadProductData, loadRecipeData, type Product, type ProductId, type Recipe } from '../graph/loadJsonData';

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
    [k in ProductId]?: { nodeId: string, edgeId?: string }[]
  },
  outputs: {
    [k in ProductId]?: { nodeId: string, edgeId?: string }[]
  }
};
export type NodeConnections = Record<string, NodeConnection>;
export type OpenConnections = {
  inputs: {[k in ProductId]?: string[]},
  outputs: {[k in ProductId]?: string[]}
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

  console.log('open connections after nodes', JSON.stringify(openConnections,null,2) )

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

  return {nodeConnections, openConnections};
}

export type FactoryGoal = {
  productId: ProductId,
  qty: number,
  type: "eq" | "lt" | "gt",
  dir: "input" | "output"
};

export const buildLpp = (nodeConnections: NodeConnections, openConnections: OpenConnections, goals: FactoryGoal[]) => {
  // To build a constrain for an item we need to know all the usages that are linked together. 
  // For simple a->b paths that is a - b = 0
  // For one to many paths a->[b,c] that is a - b - c = 0
  // For many to many we need to walk the tree, finding connections on either end and adding them to the constraint.

  // Every constraint needs to know what to add and subtract, what item it's for and which nodes they came from
  // The constraint "label" in LPP will be the item (+ a uniq), while the nodes will be the variables (the recipe / building)
  type Constraint = {
    id: string,
    productId: ProductId,
    terms: ({
      nodeId?: string,
      id: string,
      term: string
    })[],
  };
  const constraints: Constraint[] = [];

  // Which edges ends (vertices) have already appeared in constraints (via walking)
  const vertexInConstraints: Record<string, string> = {};

  // Get an LPP appropriate label for a node ID. They can't be long or contain some chars
  // They need a consistent label among all terms though so it needs storing somewhere
  const nodeIdToLabels = {} as Record<string, string>;
  let nodeLabelInc = 0;
  const getNodeLabel = (node: string) => (nodeIdToLabels[node] ||= "n_" + nodeLabelInc++, nodeIdToLabels[node]);

  const walkConnections = (nodeId: string, productId: ProductId, isInput: boolean, constraintId: string): Constraint["terms"] => {
    const ioString = isInput ? "inputs" : "outputs";
    const connections = nodeConnections[nodeId][ioString][productId];

    const vertextId = `${nodeId}/${ioString}/${productId}`;

    if (vertexInConstraints[vertextId] !== undefined) return [];
    vertexInConstraints[vertextId] = constraintId;

    const terms: Constraint["terms"] = [];

    const recipeQty = nodeConnections[nodeId].recipe[ioString].find(p => productId == p.id)?.quantity
    if (!recipeQty) {
      console.error('Could not find recipe quantity for', productId, 'as', ioString, 'on', nodeId);
      return [];
    }

    terms.push({
      id: getNodeLabel(nodeId),
      nodeId: nodeId,
      term: (isInput ? "-" : "+") + recipeQty
    });

    connections?.forEach(conn => {
      // Get all the connections on the otherside of this edge
      // If we're processing an input, we're getting all their outputs, and vice versa.
      terms.push(...walkConnections(conn.nodeId, productId, !isInput, constraintId));
    })

    return terms;
  }

  const metaConstraints: {
    [k in ProductId]?: Constraint      
  } = {};

  const bounds: string[] = [];
  /**
   * Meta Constraints contrast recipe constraints. 
   * Some things must be balanced across the whole graph, not just between many-many recipe relationships
   * i.e. Global Inputs / outputs, goal products, and multi use items 
   */
  const addMetaConstraint = (productId: ProductId, isInput: boolean, parentConstraintId: string) => {
    (metaConstraints[productId] ||= {
      terms: [],
      id: productId + "_sink",
      productId: productId
    }).terms.push({
      id: parentConstraintId + "_sink",
      term: isInput ? "-" : "+"
    })    
  }

  const newConstraint = (nodeId: string, productId: ProductId, isInput: boolean) => {
    const constraintId = `c${constraintIdInc++}`;

    const terms = walkConnections(nodeId, productId, isInput, constraintId);
    if (terms.length) {      
      terms.push({
        id: constraintId + "_sink",
        term: "+"
      });      

      constraints.push({
        id: constraintId,
        productId,
        terms
      });

      // If it's an open connection (nothing attached), 
      // it needs a meta constraint adding, for tracking across multiple nodes
      // if not, it needs bounding to 0 until we WANT it to be free
      if (openConnections.inputs[productId] !== undefined) 
        addMetaConstraint(productId, true, constraintId)
      else if (openConnections.outputs[productId] !== undefined) 
        addMetaConstraint(productId, false, constraintId)
      else bounds.push(constraintId + "_sink");
    }
    console.log("Constraint", constraintId, constraints[constraints.length - 1]);
  }

  // Loop all the inputs and outputs found in nodeConnections 
  let constraintIdInc = 0;
  for (const nodeId of Object.keys(nodeConnections)) {
    for (const productId of Object.keys(nodeConnections[nodeId].inputs) as ProductId[]) {
      newConstraint(nodeId, productId, true);
    }

    for (const productId of Object.keys(nodeConnections[nodeId].outputs) as ProductId[]) {
      newConstraint(nodeId, productId, false);
    }
  }

  getKeysTyped(metaConstraints).forEach(productId => {
    const constraint = metaConstraints[productId];

    if (constraint !== undefined) {
      // if (constraint.terms.length > 1) {
        constraint.terms.push({
          id: constraint.id,
          term: "-"
        });
        constraints.push(constraint)
      // }
      
    }
  })

  const objective = getKeysTyped(openConnections.inputs).map(i => metaConstraints[i]?.id).join('+')
  const constraintsMap = new Map<string, Constraint>;
  const constraintsList = constraints.map(con => {
    constraintsMap.set(con.id, con);

    return `
      ${con.id}: ${con.terms.map(t => `${t.term} ${t.id}`).join(' ')} = 0`;
  }).join('');

  let boundsList = getKeysTyped(metaConstraints).map(c =>
    metaConstraints[c]?.terms.map(t => {
      return `  ${t.id} free`
    }).join('\n')
  ).join('\n');

  boundsList += "\n" + bounds.map(b => `${b} = 0`).join('\n');

  boundsList += "\n" + goals.map(g => {
    // The LT and GT here are flipped because the sinks are negated. Must be less than 20 == must be greater than -20
    return `
    ${metaConstraints[g.productId]?.id} ${g.type == "lt" ? ">=" : g.type == "gt" ? "<=" : "="} -${g.qty}`
  }).join("\n");

  let lpp = `
minimize
  obj: ${objective}
subject to 
  ${constraintsList}
Bounds 
  ${boundsList}
end`;

  return { constraints, lpp, nodeIdToLabels, constraintsMap };
}


  function getKeysTyped<T extends {}>(obj: T): (keyof T)[] {
    return Object.keys(obj) as (keyof typeof obj)[];
  }
