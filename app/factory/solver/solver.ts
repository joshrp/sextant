import Highs, { type HighsSolution, type Highs as HighsType } from "highs";
import { loadRecipeData, type ProductId, type Recipe } from "../graph/loadJsonData";

import type { CustomNodeType } from '../graph/nodes';
import type { CustomEdgeType } from '../graph/edges';
import type { Constraint, EqualityTypes, FactoryGoal, NodeConnection, NodeConnections, OpenConnections, Solution } from "./types";

const recipeData = loadRecipeData();


/** 
 * Some terms:
 * Node - A box on the graph, almost always a Recipe Node (others planned)
 * Vertex - A single input / output product on a node,
 * Edge - A connection between vertices
 * "NodeConnections" / "Connections" a graph structure built from nodes & edges
 * Constraint - An equation binding two or more nodes, usually a recipe amount. 
 *    e.g. 2 water from desalination - 4 water from boiling = 0
 *    this ensures water desalination has to run twice as often as boiling
 * Loose Constraint - A Constraint that is bound by >= 0 or <= 0 instead of = 0. 
 *    They are "loose" when there is a larger constraint bounding them to zero. 
 *    Often when there's a large connection of nodes, 
 *    each individual connection should be loose while the overall is tight to 0
 * 
 * For a given node there's 3 ways this can go
 * 
 * 1. 0 connections
 *   !! add open item constraint
 * 
 * 2. only 1 connection
 *     other side has 1 connection
 *      !! add equality constraint
 *     other side has many connections
 *      !! add loose constraint 
 * 
 * 3. many connections
 *     is only part of the loop (otherside also has many connections)
 *       !! add loose constraint
 *     is whole closed loop
 *       !! add = 0 constraint
*/

export default class Solver {
  private visitedVertices: Set<string> = new Set();
  public constraints: Map<string, Constraint> = new Map();
  private oneToOnes: Set<string> = new Set();
  private constraintIdInc = 0;
  public graph: NodeConnections;

  private nodeIdToLabels: Record<string, string> = {};
  private nodeLabelInc: number = 0;
  private itemConstraints: {
    [k in ProductId]?: string
  } = {};

  constructor(nodes: CustomNodeType[], edges: CustomEdgeType[]) {
    // if (!highs || !("solve" in highs)) throw new Error("Highs not initialised");
    // console.log("Solver initialized with Highs");
    this.graph = buildGraph(nodes, edges);
    this.fillConstraints();
  }

  getNodeLabel(node: string): string {
    this.nodeIdToLabels[node] ||= "n_" + this.nodeLabelInc++
    return this.nodeIdToLabels[node]
  }

  /**
   * Figure out the product amount for a node's recipe
   */
  getTerm(nodeId: string, productId: ProductId, isInput: boolean): Constraint["terms"][0] | null {
    const ioString = isInput ? "inputs" : "outputs";

    const recipeQty = this.graph?.[nodeId].recipe[ioString].find(p => productId == p.id)?.quantity
    if (!recipeQty) {
      console.error('Could not find recipe quantity for', productId, 'as', ioString, 'on', nodeId);
      return null;
    }

    return {
      id: this.getNodeLabel(nodeId),
      nodeId: nodeId,
      term: (isInput ? "-" : "+") + recipeQty
    };
  }

  /**
   * Make or reuse a constraint based on it's ID
   * This lets us add terms to existing constraints 
   *  like Item Constraints (for inputs/outputs) 
   *  and group constraints (long chains of edges for a single product)
   */
  upsertConstraint(id: string, productId: ProductId): Constraint {
    let constraint: Constraint | undefined = this.constraints.get(id);
    if (!constraint) {
      constraint = {
        terms: [],
        id: id,
        edges: new Set<string>(),
        productId: productId,
        // Default to equality, this is overridden when required
        type: "eq",
        unconnected: false,
      };

      // Add a default sink for this constraint, always negative so the end result
      //   is signed and indicates whether it's a deficit or surplus
      constraint.terms.push({
        id: id,
        term: "-"
      });

      this.constraints.set(id, constraint);
      debug('Added new item constraint for', productId, constraint)
    }

    return constraint;
  }

  gatherNodeConstraints(nodeId: string, productId: ProductId, isInput: boolean, groupConstraintId: string | null = null) {
    const ioString = isInput ? "inputs" : "outputs";
    const ioStringOpp = isInput ? "outputs" : "inputs"

    const vertextId = makeVertexId(nodeId, ioString, productId);
    // We've seen this before
    if (this.visitedVertices.has(vertextId)) { debug('Skipping vertex', vertextId); return; }
    this.visitedVertices.add(vertextId);
    debug('Processing vertex', vertextId);

    const connections = this.graph?.[nodeId]?.[ioString][productId];
    const myTerm = this.getTerm(nodeId, productId, isInput);
    if (!myTerm) return;

    // No connections means it's an open input/output
    // These are collated across all graphs for matching goals and reporting by-products and input needs
    if (!connections || connections?.length == 0) {
      debug('Open Item', vertextId);
      const itemConstraintId = ioString.slice(0, 1) + "_" + productId;
      const constraint = this.upsertConstraint(itemConstraintId, productId);
      this.itemConstraints[productId] = itemConstraintId;

      constraint.terms.push(myTerm);

      constraint.unconnected = true;
      return;
    }

    const oppositeConnections = this.graph[connections[0].nodeId][ioStringOpp][productId];
    if (oppositeConnections === undefined) return;

    // If we only have 1 connection it's either a closed 1-1, OR our neighbour has many
    // If it's a 1-1 it should balance to 0,
    // otherwise it needs to be loose
    if (connections.length == 1) {
      if (oppositeConnections.length === 1) {
        if (this.oneToOnes.has(connections[0].edgeId))
          return;
      }
      const constraint = this.upsertConstraint(`c${this.constraintIdInc++}`, productId);
      constraint.terms.push(myTerm);

      const otherTerm = this.getTerm(connections[0].nodeId, productId, !isInput);
      if (otherTerm) constraint.terms.push(otherTerm);
      constraint.edges.add(connections[0].edgeId);

      if (oppositeConnections.length > 1) {
        constraint.type = isInput ? "gt" : "lt";

        debug("I have 1 connection, they have more");
        this.gatherNodeConstraints(connections[0].nodeId, productId, !isInput);
      } else {
        this.oneToOnes.add(connections[0].edgeId);
      }
      return;
    }

    let groupConstraint: Constraint | null = null;
    // A group constraint is required if we're part of a larger loop
    // If an ID was passed in, continue with that one, 
    // otherwise check if one is needed and make it, then pass it around
    if (groupConstraintId) {
      debug('Using GROUP constraint', groupConstraintId);
      groupConstraint = this.upsertConstraint(groupConstraintId, productId);
    } else {
      // Check all my connections, if they have more than 1, start a group chat (constraint)      
      if (connections.some(conn => (this.graph[conn.nodeId][ioStringOpp][productId] || []).length > 1)) {
        groupConstraintId = `c_${productId}_${this.constraintIdInc++}`;
        debug('Creating GROUP constraint', groupConstraintId);
        groupConstraint = this.upsertConstraint(groupConstraintId, productId);
        groupConstraint.terms.push(myTerm);
        groupConstraint.type = "eq";
      }
    }

    const myConstraint = this.upsertConstraint(`c${this.constraintIdInc++}`, productId);
    myConstraint.terms.push(myTerm);

    // If there's a larger constraint this one should be variable
    if (groupConstraint) myConstraint.type = isInput ? "gt" : "lt";

    connections.forEach(conn => {
      const term = this.getTerm(conn.nodeId, productId, !isInput);
      if (term) {
        myConstraint?.edges.add(conn.edgeId);

        if (groupConstraint) {
          groupConstraint.edges.add(conn.edgeId);
          const otherVertex = makeVertexId(conn.nodeId, ioStringOpp, productId);
          // Only add the term if the other vertex hasn't ran through processing
          if (!this.visitedVertices.has(otherVertex)) {
            debug("adding term to group", term);
            groupConstraint?.terms.push(term);
          }
        }

        myConstraint?.terms.push(term);
      }

      this.gatherNodeConstraints(conn.nodeId, productId, !isInput, groupConstraintId);
    });
  }

  fillConstraints(): void {
    // Loop all the inputs and outputs found in nodeConnections 
    for (const nodeId of Object.keys(this.graph)) {
      for (const productId of Object.keys(this.graph[nodeId].inputs) as ProductId[]) {
        this.gatherNodeConstraints(nodeId, productId, true);
      }

      for (const productId of Object.keys(this.graph[nodeId].outputs) as ProductId[]) {
        this.gatherNodeConstraints(nodeId, productId, false);
      }
    }
  }

  buildLpp(goals: FactoryGoal[]): string {
    const objectives = Object.values(this.nodeIdToLabels);
    let boundsList = [];
    let constraintsList = [];
    for (const con of this.constraints.values()) {
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
      if (this.itemConstraints[g.productId] === undefined) {
        missedGoals.push(g.productId);
        return
      }
      return `${this.itemConstraints[g.productId]} ${g.type == "lt" ? "<=" : g.type == "gt" ? ">=" : "="} ${g.qty}`
    }))

    return `
min
  obj: ${objectives.join('+')}
subject to 
  ${constraintsList.join("\n")}
Bounds 
  ${boundsList.join("\n")}
end`;

  }

  solve(highs: HighsType, goals: FactoryGoal[]): Solution {
    const lpp = this.buildLpp(goals);

    let res: ReturnType<typeof highs.solve> | null = null;
    try {
      res = highs.solve(lpp); // No idea how to do the typing on this one
    } catch (e) {
      console.error('Error solving LPP');
      console.error(e);
    }
    if (!res || res.Status !== "Optimal") return {status: "Error", errorMessage: "No result"}; // TODO:: Help?

    const nodeResults: Solution["nodeCounts"] = [];
    const productResults: Solution["products"] = { inputs: [], outputs: [] };
    Object.keys(res.Columns).forEach(k => {
      const nodeLabel = k.match(nodeLabelMatcher)?.[0]
      if (nodeLabel) {
        const node = Object.keys(this.nodeIdToLabels).find(l => this.nodeIdToLabels[l] == nodeLabel);
        if (node) nodeResults.push({
          nodeId: node,
          count: res.Columns[nodeLabel].Primal,
        });
      }

      const outputLabel = k.match(outputMatcher)?.[1]
      if (outputLabel)
        productResults?.outputs.push({
          productId: outputLabel,
          amount: res.Columns[k].Primal
        });

      const inputLabel = k.match(inputMatcher)?.[1]
      if (inputLabel)
        productResults?.inputs.push({
          productId: inputLabel,
          amount: res.Columns[k].Primal
        });
    })

    return {
      status: "Solved",
      goals: goals.map(goal => {
        const columnPrefix = goal.dir == "input" ? "i" : "o";
        return {
          goal,
          resultCount: res.Columns[columnPrefix + "_" + goal.productId]?.Primal
        };
      }),
      products: productResults,
      nodeCounts: nodeResults,
      freeableConstraints: [], // TODO
    }
  }
}

function buildGraph(nodes: CustomNodeType[], edges: CustomEdgeType[]): NodeConnections {
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

  return nodeConnections;
}

const nodeLabelMatcher = /^n_\d+/;
const inputMatcher = /^i_(.+)$/;
const outputMatcher = /^o_(.+)$/;

export let DEBUG_SOLVER = false;
const debug = (...args: any[]) => {
  if (DEBUG_SOLVER)
    console.debug(...args);
}

const makeVertexId = (node: string, io: string, product: string) => {
  return `${node}/${io}/${product}`
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
