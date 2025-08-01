import highsLoader, { type Highs, type HighsSolution } from "highs";
import { loadRecipeData, type ProductId, type Recipe } from "../graph/loadJsonData";

import type { CustomEdgeType } from '../graph/edges';
import type { CustomNodeType } from '../graph/nodes';
import { type Constraint, type EqualityTypes, type FactoryGoal, type GraphModel, type ManifoldOptions, type NodeConnection, type NodeConnections, type OpenConnections, type Solution } from "./types";

const recipeData = loadRecipeData();
let highsProm: Promise<Highs>;
console.log("window", typeof window)
if (typeof window === "undefined")
  highsProm = highsLoader();
else
  highsProm = highsLoader({ locateFile: (file: string) => "https://lovasoa.github.io/highs-js/" + file });

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

export function createGraph(nodes: CustomNodeType[], edges: CustomEdgeType[]): GraphModel {
  const solver = new Solver(nodes, edges);
  return solver.toGraphModel()
}

export function buildLpp(graph: GraphModel, goals: FactoryGoal[], freeConstraints: Set<string | null>): string {
  const objectives = Object.values(graph.nodeIdToLabels);
  const boundsList = [];
  const constraintsList = [];
  for (const con of Object.values(graph.constraints)) {
    constraintsList.push(`${con.id}: ${con.terms.map(t => `${t.term} ${t.id}`).join(' ')} ${getEquality(con.equality)} 0`);

    if (con.unconnected || freeConstraints.has(con.id))
      boundsList.push(`${con.id} free`);
    else
      boundsList.push(`${con.id} = 0`);
  };

  // Keep track of missed goals to flag them
  const missedGoals: string[] = [];

  boundsList.push(...goals.map(g => {
    if (!graph.itemConstraints.has(g.productId)) {
      missedGoals.push(g.productId);
      return
    }
    return `${graph.itemConstraints.get(g.productId)} ${getEquality(g.type)} ${g.qty}`
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

/**
 * TODO:: Mark constraints belonging to a group
 * Use those to figure out which group actually helps solve an infeasible siolution
 * Loop through, disable whole group, then individuals along with it. Start wide, then shrink. Use objective value to order them
 *  */
async function getHighsSolution(graph: GraphModel, goals: FactoryGoal[], freeConstraints: Set<string | null>): Promise<HighsSolution | null> {
  const t0 = performance.now();
  const lpp = buildLpp(graph, goals, freeConstraints);
  debug(lpp);
  
  const highs = await highsProm;
  let res: ReturnType<typeof highs.solve> | null = null;
  try {
    res = highs.solve(lpp);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.error('Error solving LPP');
    console.error(e);
    res = null;
  }
  console.log("Highs solve time", performance.now() - t0, "ms", freeConstraints);
  return res;
}

export async function solve(graph: GraphModel, goals: FactoryGoal[], manifolds: ManifoldOptions[] = [], autoSolve: boolean): 
  Promise<{solution: Solution, manifolds?: ManifoldOptions[]} | "Error" | "Infeasible"> {
  const freeConstraints = new Set(manifolds.map(m => m.free ? m.constraintId : null).filter(x => x !== null));
  const res = await getHighsSolution(graph, goals, freeConstraints);

  if (!res) return "Error";
  if (res.Status == "Optimal")
    return {
      solution: parseHighsSolution(res, graph, goals)
    }

  else if (autoSolve) {
    const solutions:{
      constraintId: string,
      freeConstraints: Set<string>,
      solution: HighsSolution | null,
    }[] = [];
    // Try freeing all major manifolds and their children to see if anything works
    await Promise.all(Object.keys(graph.constraints).map(async c => {    
      // Start with the original free constraints, then add the rest
      const newFreeConstraints = new Set(freeConstraints);
      const constraint = graph.constraints[c];
      const parentFree = constraint.parent && newFreeConstraints.has(constraint.parent);
      const childFree = (constraint.children || []).some(c => newFreeConstraints.has(c));
      if (constraint.unconnected || newFreeConstraints.has(constraint.id) || parentFree || childFree) {
        debug("Skipping constraint", constraint.id, "as it or it's parent is already free");
        return;
      }
      if (constraint.parent !== undefined) return;
      debug("Making constraint", constraint.id, "free");

      newFreeConstraints.add(constraint.id);
      constraint.children?.forEach(childId => {
        debug("Adding child constraint", childId, "to free constraints"); 
        newFreeConstraints.add(childId);
      });
      solutions.push({
        constraintId: c,
        freeConstraints: newFreeConstraints,
        solution: await getHighsSolution(graph, goals, newFreeConstraints)
      });
    }));
    const working = solutions.filter(x => x.solution?.Status == "Optimal" && x.solution?.ObjectiveValue > 0).sort((a, b) => {
      const aObj = a.solution?.ObjectiveValue || 0;
      const bObj = b.solution?.ObjectiveValue || 0;
      return aObj - bObj;
    });

    debug("Solutions found", working.length, "with optimal status");
    if (working.length > 0) {
      const best = working[0];
      debug("Best solution found for constraint", best.constraintId, "with objective value", best.solution?.ObjectiveValue);
      return {
        solution: parseHighsSolution(best.solution as HighsSolution, graph, goals),
        manifolds: Array.from(best.freeConstraints).map(c => {
          const constraint = graph.constraints[c];
          return {
            constraintId: c,
            edges: constraint.edges,
            free: true
          }
        })
      }
    }
  }

  return "Infeasible";
}

function parseHighsSolution(res: HighsSolution, graph: GraphModel, goals: FactoryGoal[]): Solution {
  if (res.Status !== "Optimal") throw new Error("Cannot parse solution, not optimal");

  const nodeResults: Solution["nodeCounts"] = [];
  const productResults: Solution["products"] = { inputs: [], outputs: [] };
  const manifoldResults: Solution["manifolds"] = {};
  const manifoldsSet = new Set(Object.keys(graph.constraints));
  Object.keys(res.Columns).forEach(k => {
    const nodeLabel = k.match(nodeLabelMatcher)?.[0]
    if (nodeLabel) {
      const node = Object.keys(graph.nodeIdToLabels).find(l => graph.nodeIdToLabels[l] == nodeLabel);
      if (node) nodeResults.push({
        nodeId: node,
        count: res.Columns[nodeLabel].Primal,
      });
    }

    const outputLabel = k.match(outputMatcher)?.[1]
    if (outputLabel)
      productResults?.outputs.push({
        productId: outputLabel as ProductId,
        amount: res.Columns[k].Primal
      });

    const inputLabel = k.match(inputMatcher)?.[1]
    if (inputLabel)
      productResults?.inputs.push({
        productId: inputLabel as ProductId,
        amount: res.Columns[k].Primal
      });
    if (manifoldsSet.has(k)) {
      manifoldResults[k] = res.Columns[k].Primal;
    }
  });

  return {
    goals: goals.map(goal => {
      const columnPrefix = goal.dir == "input" ? "i" : "o";
      return {
        goal,
        resultCount: res.Columns[columnPrefix + "_" + goal.productId]?.Primal
      };
    }),
    products: productResults,
    nodeCounts: nodeResults,
    manifolds: manifoldResults,
    ObjectiveValue: res.ObjectiveValue,
  }
}

export default class Solver {
  private nodeLabelInc: number = 0;
  private visitedVertices: Set<string> = new Set();
  private constraintIdInc = 0;
  private oneToOnes: Set<string> = new Set();

  public constraints: { [key: string]: Constraint } = {};
  public graph: NodeConnections;

  public nodeIdToLabels: Record<string, string> = {};
  private nodes: CustomNodeType[];
  private edges: CustomEdgeType[];
  public itemConstraints: Map<ProductId, string> = new Map();

  constructor(nodes: CustomNodeType[], edges: CustomEdgeType[]) {
    this.nodes = nodes;
    this.edges = edges;
    this.graph = buildGraph(nodes, edges);
    this.fillConstraints();
  }

  toGraphModel(): GraphModel {
    return {
      constraints: this.constraints,
      nodeIdToLabels: this.nodeIdToLabels,
      graph: this.graph,
      itemConstraints: this.itemConstraints,
      nodes: this.nodes,
      edges: this.edges,
    }
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
  getOrCreateConstraint(id: string, productId: ProductId): Constraint {
    let constraint: Constraint | undefined = this.constraints[id];
    if (!constraint) {
      constraint = {
        terms: [],
        id: id,
        edges: {} as { [k: string]: boolean },
        productId: productId,
        // Default to equality, this is overridden when required
        equality: "eq",
        unconnected: false,
        children: [],
      };

      // Add a default sink for this constraint, always negative so the end result
      //   is signed and indicates whether it's a deficit or surplus
      constraint.terms.push({
        id: id,
        term: "-"
      });

      this.constraints[id] = constraint;
      debug('Added new constraint for', productId, constraint)
    }

    return constraint;
  }

  gatherNodeConstraints(nodeId: string, productId: ProductId, isInput: boolean, groupConstraintId: string | null = null, childConstraintId: string | null = null): void {
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
      const constraint = this.getOrCreateConstraint(itemConstraintId, productId); this.itemConstraints.set(productId, itemConstraintId);

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
        this.oneToOnes.add(connections[0].edgeId);
      }
      const constraint = this.getOrCreateConstraint(`c${this.constraintIdInc++}`, productId);
      constraint.terms.push(myTerm);

      const otherTerm = this.getTerm(connections[0].nodeId, productId, !isInput);
      if (otherTerm) constraint.terms.push(otherTerm);
      constraint.edges[connections[0].edgeId] = true;

      if (oppositeConnections.length > 1) {
        constraint.equality = isInput ? "gt" : "lt";

        debug("I have 1 connection, they have more");
        if (groupConstraintId) {
          constraint.parent = groupConstraintId;
          this.constraints[groupConstraintId]?.children.push(constraint.id);
        }
        this.gatherNodeConstraints(connections[0].nodeId, productId, !isInput, null, constraint.id);
      }
      return;
    }

    const myConstraint = this.getOrCreateConstraint(`c${this.constraintIdInc++}`, productId);
    myConstraint.terms.push(myTerm);

    let groupConstraint: Constraint | null = null;
    // A group constraint is required if we're part of a larger loop
    // If an ID was passed in, continue with that one, 
    // otherwise check if one is needed and make it, then pass it around
    if (groupConstraintId) {
      debug('Using GROUP constraint', groupConstraintId);
      groupConstraint = this.constraints[groupConstraintId];
    } else {
      // Check all my connections, if they have more than 1, start a group chat (constraint)      
      if (connections.some(conn => (this.graph[conn.nodeId][ioStringOpp][productId] || []).length > 1)) {
        groupConstraintId = `c_${productId}_${this.constraintIdInc++}`;
        debug('Creating GROUP constraint', groupConstraintId);
        groupConstraint = this.getOrCreateConstraint(groupConstraintId, productId);
        groupConstraint.terms.push(myTerm);
        groupConstraint.equality = "eq";
        if (childConstraintId) {
          // One of the children of this group kicked it off, so add it to the group
          groupConstraint.children.push(childConstraintId);
          debug("Adding child constraint to group", childConstraintId);
          this.constraints[childConstraintId].parent = groupConstraintId;
        }
      } else {
        // There's no surrounding group, this is the whole manifold
        groupConstraintId = myConstraint.id;
        debug("No group constraint, using my own to pass to children", myConstraint.id);
      }
    }

    // If there's a larger constraint this one should be variable
    if (groupConstraint && groupConstraintId) {
      myConstraint.parent = groupConstraintId;
      groupConstraint?.children.push(myConstraint.id)
      myConstraint.equality = isInput ? "gt" : "lt";
    }

    connections.forEach(conn => {
      const term = this.getTerm(conn.nodeId, productId, !isInput);
      if (term) {
        myConstraint.edges[conn.edgeId] = true;

        if (groupConstraint) {
          groupConstraint.edges[conn.edgeId] = true;

          debug("adding term to group", term);
          if (groupConstraint?.terms.find(x => x.id == term.id) === undefined)
            groupConstraint?.terms.push(term);
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
}

function buildGraph(nodes: CustomNodeType[], edges: CustomEdgeType[]): NodeConnections {
  const nodesById: Record<string, CustomNodeType> = {};

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

// Instead of exporting a variable, export a setter function
let DEBUG_SOLVER = false;
export function setDebugSolver(val: boolean) {
  DEBUG_SOLVER = val;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
