import highsLoader, { type Highs, type HighsOptions, type HighsSolution } from "highs";
import { loadData, type ProductId, type Recipe } from "../graph/loadJsonData";

import type { CustomEdgeType } from '../graph/edges';
import type { CustomNodeType } from '../graph/nodes';
import { type Constraint, type EqualityTypes, type FactoryGoal, type GraphModel, type ManifoldOptions, type NodeConnection, type NodeConnections, type OpenConnections, type Solution } from "./types";
import { maintenanceKey } from "~/uiUtils";

const recipeData = loadData().recipes;
let highsProm: Promise<Highs>;
if (typeof window === "undefined")
  highsProm = highsLoader();
else
  highsProm = highsLoader({ locateFile: (file: string) => "https://lovasoa.github.io/highs-js/" + file });

const highsOptions: HighsOptions = { time_limit: 2, small_matrix_value: 1e-4 };
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

const infraConstraintId = "in_frastructure_total";

const infrastructureProducts: { [key in keyof Partial<Solution["infrastructure"]>]: string } = {
  workers: "Product_Virtual_Worker",
  electricity: "Product_Virtual_Electricity",
  computing: "Product_Virtual_Computing",
  maintenance_1: "Product_Virtual_MaintenanceT1",
  maintenance_2: "Product_Virtual_MaintenanceT2",
  maintenance_3: "Product_Virtual_MaintenanceT3",
};

export function buildLpp(graph: GraphModel, goals: FactoryGoal[], freeConstraints: Set<string | null>, scoreMethod: string): string {
  let objectives: string[] = [];
  debug("Building LPP with score method '", scoreMethod, "'", graph.nodeIdToLabels);
  switch (scoreMethod) {
    case "inputs":
      objectives = graph.itemConstraints.values().map(c => {
        return c.match(inputMatcher) !== null ? c : null;
      }).toArray().filter(x => x !== null);
      objectives.push("-0.01 " + infraConstraintId); // Slightly prefer solutions with less infrastructure and footprint
      objectives.push("-0.01 in_footprint"); 
      break;
    case "infra":
      // I would use "infra_" here, but nothing can start with "inf" without causing Highs to error...
      // TODO:: Figure out how to weight these properly
      objectives = [infraConstraintId, "0.01 in_footprint"];

      break;
    case "footprint":
      objectives = ["in_footprint"];
      break;
    case "outputs":
      objectives = graph.itemConstraints.values().map(c => {
        return c.match(outputMatcher) !== null ? c : null;
      }).toArray().filter(x => x !== null);
      break;
    default:
      throw new Error("Unknown score method " + scoreMethod);
  }

  const boundsList = [];
  const constraintsList = [];
  for (const con of Object.values(graph.constraints)) {
    constraintsList.push(`${con.id}: ${con.terms.map(t => `${t.sign} ${t.weight * (t.value || 1)} ${t.id}`).join(' ')} ${getEquality(con.equality)} 0`);

    if (goals.find(g => g.productId == con.productId)) continue;

    // Find any optional terms, they need appropriate sinks
    const optionals = con.terms.reduce((acc, t) => {
      if (t.optional) {
        if (t.isInput) acc.input = true;
        else acc.output = true;
      }
      return acc;
    }, { input: false, output: false, });

    // If there's optional inputs and outputs, it can be free
    if (optionals.input && optionals.output)
      con.unconnected = true;

    con.terms.filter(t => t.optional);
    if (con.unconnected || freeConstraints.has(con.id))
      boundsList.push(`${con.id} free`);
    else if (optionals.output)
      boundsList.push(`0 <= ${con.id} <= inf`);
    else if (optionals.input)
      boundsList.push(`-inf <= ${con.id} <= 0`);
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
    let prefix = '';
    if (g.type == "lt")
      prefix = "-inf <=";

    return `${prefix} ${graph.itemConstraints.get(g.productId)} ${getEquality(g.type)} ${g.qty}`
  }))

  // Make an integer of every node for use in Workers and Footprint calculations
  const integerNodes = Object.values(graph.nodeIdToLabels).map(n => {
    return [
      n + "_int",
      `${n}_lower: ${n}_int - ${n} >= 0
  ${n}_upper: ${n}_int - ${n} <= 0.99999`
    ]
  });

  // Inputs and outpus should maximize (the input constraints we're using are negative, higher number = using less)
  return `
${["infra", "footprint"].includes(scoreMethod) ? "Minimize" : "Maximize"}
  obj: ${objectives.join('+')}
Subject To 
  ${constraintsList.join("\n  ")}
  ${integerNodes.map(n => n[1]).join("\n  ")}
Bounds 
  ${boundsList.join("\n  ")}
  ${Object.values(graph.nodeIdToLabels).map(n => `${n} >= 0`).join("\n  ")}
  ${integerNodes.map(n => n[0] + " free").join("\n  ")}
General
  ${integerNodes.map(n => n[0]).join("\n  ")}
End`;

}

/**
 * TODO:: Mark constraints belonging to a group
 * Use those to figure out which group actually helps solve an infeasible siolution
 * Loop through, disable whole group, then individuals along with it. Start wide, then shrink. Use objective value to order them
 *  */
async function getHighsSolution(graph: GraphModel, goals: FactoryGoal[], freeConstraints: Set<string | null>, scoreMethod: string): Promise<HighsSolution | null> {
  const t0 = performance.now();
  const lpp = buildLpp(graph, goals, freeConstraints, scoreMethod);
  debug(lpp);

  const highs = await highsProm;
  let res: ReturnType<typeof highs.solve> | null = null;
  try {
    res = highs.solve(lpp, highsOptions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.error('Error solving LPP');
    console.error(e);
    res = null;
  }

  console.log("Highs solve time", performance.now() - t0, "ms", freeConstraints, res);
  return res;
}

export async function solve(graph: GraphModel, goals: FactoryGoal[], manifolds: ManifoldOptions[] = [], scoreMethod: string, autoSolve: boolean):
  Promise<{ solution: Solution, manifolds?: ManifoldOptions[] } | "Error" | "Infeasible"> {
  const freeConstraints = new Set(manifolds.map(m => m.free ? m.constraintId : null).filter(x => x !== null));
  const res = await getHighsSolution(graph, goals, freeConstraints, scoreMethod);

  if (!res) return "Error";
  if (res.Status == "Optimal")
    return {
      solution: parseHighsSolution(res, graph, goals)
    }
  if (res.Status == "Time limit reached") {
    console.warn("Highs time limit reached, returning error");
    // TODO:: Let them know it's likely Unbounded
    return "Error";
  }

  else if (autoSolve) {
    const solutions: {
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
        solution: await getHighsSolution(graph, goals, newFreeConstraints, scoreMethod)
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

function parseHighsNumberResult(num: number): number {
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round(num * 1e9) / 1e9;
}

function parseHighsSolution(res: HighsSolution, graph: GraphModel, goals: FactoryGoal[]): Solution {
  if (res.Status !== "Optimal") throw new Error("Cannot parse solution, not optimal");

  const nodeResults: Solution["nodeCounts"] = [];
  const productResults: Solution["products"] = { inputs: [], outputs: [] };
  const manifoldResults: Solution["manifolds"] = {};
  const manifoldsSet = new Set(Object.keys(graph.constraints));
  const infraResults: Solution["infrastructure"] = {
    workers: 0, electricity: 0, computing: 0, maintenance_1: 0, maintenance_2: 0, maintenance_3: 0, footprint: 0,
  };

  Object.keys(res.Columns).forEach(k => {
    const nodeLabel = k.match(nodeLabelMatcher)?.[0]
    if (nodeLabel) {
      const node = Object.keys(graph.nodeIdToLabels).find(l => graph.nodeIdToLabels[l] == nodeLabel);
      if (node) nodeResults.push({
        nodeId: node,
        count: parseHighsNumberResult(res.Columns[nodeLabel].Primal),
      });
    }

    const outputLabel = k.match(outputMatcher)?.[1]
    if (outputLabel)
      productResults?.outputs.push({
        productId: outputLabel as ProductId,
        amount: parseHighsNumberResult(res.Columns[k].Primal)
      });

    const inputLabel = k.match(inputMatcher)?.[1]
    if (inputLabel)
      productResults?.inputs.push({
        productId: inputLabel as ProductId,
        amount: parseHighsNumberResult(res.Columns[k].Primal)
      });

    const infraLabel = k.match(infraMatcher)?.[1]
    if (infraLabel)
      infraResults[infraLabel as keyof Solution["infrastructure"]] = parseHighsNumberResult(res.Columns[k].Primal);

    if (manifoldsSet.has(k)) {
      manifoldResults[k] = parseHighsNumberResult(res.Columns[k].Primal);
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
    infrastructure: infraResults,
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
  getTermOfNode(nodeId: string, productId: ProductId, isInput: boolean): Constraint["terms"][0] | null {
    const ioString = isInput ? "inputs" : "outputs";
    const recipe = recipeData.get(this.graph?.[nodeId].recipeId);
    if (!recipe) {
      throw new Error(`Recipe not found for node ${nodeId} with recipeId ${this.graph?.[nodeId].recipeId}`);
    }
    const recipeItem = recipe[ioString].find(p => productId == p.product.id);
    if (!recipeItem) {
      console.error('Could not find recipe quantity for', productId, 'as', ioString, 'on', nodeId);
      return null;
    }

    return {
      id: this.getNodeLabel(nodeId),
      nodeId: nodeId,
      isInput,
      value: recipeItem.quantity,
      weight: 1,
      sign: isInput ? "-" : "+",
      optional: recipeItem.optional || false,
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
        isInput: true,
        value: 1,
        sign: "-",
        weight: 1,
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
    const myTerm = this.getTermOfNode(nodeId, productId, isInput);
    if (!myTerm) return;

    // No connections means it's an open input/output
    // These are collated across all graphs for matching goals and reporting by-products and input needs
    if (!connections || connections?.length == 0) {
      debug('Open Item', vertextId);
      const itemConstraintId = (isInput ? 'i' : 'o') + "_" + productId;
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

      const otherTerm = this.getTermOfNode(connections[0].nodeId, productId, !isInput);
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
        if (childConstraintId) {
          // One of the children of this group kicked it off, so add it to the group
          myConstraint.children.push(childConstraintId);
          debug("Adding child constraint to my group", childConstraintId);
          this.constraints[childConstraintId].parent = myConstraint.id;
        }
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
      const term = this.getTermOfNode(conn.nodeId, productId, !isInput);
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
    // Add a constraint that sums all infrastructure products
    const infraConstraint = this.getOrCreateConstraint(infraConstraintId, "Score_Infrastructure" as ProductId);
    infraConstraint.unconnected = true;

    for (const key of Object.keys(infrastructureProducts) as (keyof Solution["infrastructure"])[]) {
      const infraId = "in_" + key;
      // TODO:: Add weights to these based on user settings
      let weight = 1;
      switch (key) {
        case "electricity":
        case "computing":
          weight = 0.01;
          break;
        case "maintenance_2":
          weight = 10;
          break;
        case "maintenance_3":
          weight = 50;
          break;
      }

      infraConstraint.terms.push({
        id: infraId,
        isInput: true,
        sign: "+",
        weight,
      });
    }

    this.constraints[infraConstraintId] = infraConstraint;
    // Loop all the inputs and outputs found in nodeConnections 
    for (const nodeId of Object.keys(this.graph)) {
      this.addInfraConstraints(nodeId);
      for (const productId of Object.keys(this.graph[nodeId].inputs) as ProductId[]) {
        this.gatherNodeConstraints(nodeId, productId, true);
      }

      for (const productId of Object.keys(this.graph[nodeId].outputs) as ProductId[]) {
        this.gatherNodeConstraints(nodeId, productId, false);
      }
    }
  }

  addInfraConstraints(nodeId: string): void {
    const recipe = recipeData.get(this.graph[nodeId].recipeId)!;
    const label = this.getNodeLabel(nodeId);

    // Workers
    if (recipe.machine.workers && recipe.machine.workers > 0) {
      const constraint = this.getOrCreateConstraint("in_workers", "Product_Virtual_Workers" as ProductId);
      constraint.unconnected = true;

      constraint.terms.push({
        id: label + "_int",
        nodeId: nodeId,
        value: recipe.machine.workers,
        sign: "+",
        weight: 1,
        isInput: true,
      });
    }
    // Electricity
    if (recipe.machine.electricity_consumed && recipe.machine.electricity_consumed > 0) {
      const constraint = this.getOrCreateConstraint("in_electricity", "Product_Virtual_Electricity" as ProductId);
      constraint.unconnected = true;
      constraint.terms.push({
        id: label,
        nodeId: nodeId,
        value: recipe.machine.electricity_consumed,
        sign: "+",
        weight: 1,
        isInput: true,
      });

    }
    // Computing
    if (recipe.machine.computing_consumed && recipe.machine.computing_consumed > 0) {
      const constraint = this.getOrCreateConstraint("in_computing", "Product_Virtual_Computing" as ProductId);
      constraint.unconnected = true;

      constraint.terms.push({
        id: label,
        nodeId: nodeId,
        value: recipe.machine.computing_consumed,
        sign: "+",
        weight: 1,
        isInput: true,
      });
    }
    // Maintenance
    if (recipe.machine.maintenance_cost && recipe.machine.maintenance_cost.quantity > 0) {

      const constraint = this.getOrCreateConstraint("in_" + maintenanceKey(recipe.machine), recipe.machine.maintenance_cost.id as ProductId);
      constraint.unconnected = true;

      constraint.terms.push({
        id: label,
        nodeId: nodeId,
        value: recipe.machine.maintenance_cost.quantity,
        sign: "+",
        weight: 1,
        isInput: true,
      });
    }

    // Footprint
    if (recipe.machine.footprint && recipe.machine.footprint.length == 2) {
      const area = recipe.machine.footprint[0] * recipe.machine.footprint[1];
      if (area > 0) {
        const constraint = this.getOrCreateConstraint("in_footprint", "Product_Virtual_Footprint" as ProductId);
        constraint.unconnected = true;

        constraint.terms.push({
          id: label + "_int",
          nodeId: nodeId,
          value: area,
          sign: "+",
          weight: 1,
          isInput: true,
        });
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
    nodeRecipe[node.id] = recipeData.get(node.data.recipeId)!;
    const inputs: NodeConnection["inputs"] = {};
    const outputs: NodeConnection["outputs"] = {};

    nodeRecipe[node.id].inputs.forEach(input => {
      inputs[input.product.id] = [];
      (openConnections.inputs[input.product.id] ||= []).push(node.id)
    });

    nodeRecipe[node.id].outputs.forEach(output => {
      outputs[output.product.id] = [];
      (openConnections.outputs[output.product.id] ||= []).push(node.id)
    });

    nodeConnections[node.id] = {
      recipeId: node.data.recipeId,
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
const infraMatcher = /^in_(.+)$/;

// Instead of exporting a variable, export a setter function
let DEBUG_SOLVER = true;
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
