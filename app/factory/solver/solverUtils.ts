/**
 * Pure utility functions extracted from solver.ts
 * These functions have minimal inputs and perform complex logic without side effects.
 * They do not depend on mutable state or external resources beyond static game data.
 */

import type { HighsSolution } from "highs";
import type { CustomEdgeType } from '../graph/edges';
import type { ProductId, Recipe } from "../graph/loadJsonData";
import type { CustomNodeType } from '../graph/nodeTypes';
import type { EqualityTypes, FactoryGoal, GraphModel, GraphScoringMethod, NodeConnection, NodeConnections, OpenConnections, Solution } from "./types";

// Regex matchers for parsing HiGHS solution columns
export const nodeLabelMatcher = /^n_\d+/;
export const inputMatcher = /^i_(.+)$/;
export const outputMatcher = /^o_(.+)$/;
export const infraMatcher = /^in_(.+)$/;

/**
 * Parse a number from HiGHS solution, handling NaN and Infinity
 */
export function parseHighsNumberResult(num: number): number {
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round(num * 1e9) / 1e9;
}

/**
 * Convert equality type to operator string
 */
export function getEquality(type: EqualityTypes): string {
  switch (type) {
    case "eq":
      return "=";
    case "gt":
      return ">=";
    case "lt":
      return "<=";
  }
}

/**
 * Create a vertex identifier from node, io type, and product
 */
export function makeVertexId(node: string, io: string, product: string): string {
  return `${node}/${io}/${product}`;
}

/**
 * Parse HiGHS solution into a structured Solution object
 * This is a pure function that extracts and organizes solution data.
 * 
 * @param res - HiGHS solution result
 * @param graph - Graph model with constraints and node labels
 * @param goals - Factory goals to evaluate against
 * @param scoreMethod - Scoring method used for the solution
 * @returns Structured Solution object
 */
export function parseHighsSolution(res: HighsSolution, graph: GraphModel, goals: FactoryGoal[], scoreMethod: GraphScoringMethod, recipeData: Map<string, Recipe>): Solution {
  if (res.Status !== "Optimal") throw new Error("Cannot parse solution, not optimal");

  const nodeResults: Solution["nodeCounts"] = [];
  const productResults: Solution["products"] = { inputs: [], outputs: [] };
  const manifoldResults: Solution["manifolds"] = {};
  const manifoldsSet = new Set(Object.keys(graph.constraints));
  const infraResults: Solution["infrastructure"] = {
    workers: 0, electricity: 0, computing: 0, maintenance_1: 0, maintenance_2: 0, maintenance_3: 0, footprint: 0,
    workers_generated: 0,
    electricity_generated: 0,
    computing_generated: 0,
    maintenance_1_generated: 0,
    maintenance_2_generated: 0,
    maintenance_3_generated: 0,
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

  // Post-processing: Calculate total generated infrastructure from nodeCounts
  nodeResults.forEach(({ nodeId, count }) => {
    const node = graph.graph[nodeId];
    if (node) {
      const recipe = recipeData.get(node.recipeId);
      if (recipe?.machine) {
        infraResults.electricity_generated += (recipe.machine.electricity_generated || 0) * count;
        infraResults.computing_generated += (recipe.machine.computing_generated || 0) * count;
        infraResults.workers_generated += (recipe.machine.workers_generated || 0) * Math.ceil(count);
        
        // Maintenance generation - need to determine which tier
        if (recipe.machine.maintenance_generated && recipe.machine.maintenance_generated.quantity > 0) {
          const maintenanceId = recipe.machine.maintenance_generated.id as string;
          if (maintenanceId === "Product_Virtual_MaintenanceT1") {
            infraResults.maintenance_1_generated += recipe.machine.maintenance_generated.quantity * count;
          } else if (maintenanceId === "Product_Virtual_MaintenanceT2") {
            infraResults.maintenance_2_generated += recipe.machine.maintenance_generated.quantity * count;
          } else if (maintenanceId === "Product_Virtual_MaintenanceT3") {
            infraResults.maintenance_3_generated += recipe.machine.maintenance_generated.quantity * count;
          }
        }
      }
    }
  });

  return {
    goals: goals.map(goal => {
      const columnPrefix = goal.qty < 0 ? "i" : "o";
      return {
        goal,
        resultCount: res.Columns[columnPrefix + "_" + goal.productId]?.Primal
      };
    }),
    scoringMethod: scoreMethod,
    products: productResults,
    nodeCounts: nodeResults,
    manifolds: manifoldResults,
    infrastructure: infraResults,
    ObjectiveValue: res.ObjectiveValue,
  }
}

/**
 * Build the node connections graph from nodes and edges
 * This is a pure function that takes the React Flow nodes and edges and creates
 * a graph structure suitable for constraint generation.
 * 
 * @param nodes - The React Flow nodes representing recipes
 * @param edges - The React Flow edges representing product flows
 * @param recipeData - Map of recipe data (injected for purity)
 * @returns NodeConnections graph structure
 */
export function buildNodeConnections(
  nodes: CustomNodeType[], 
  edges: CustomEdgeType[],
  recipeData: Map<string, Recipe>
): NodeConnections {
  const nodesById: Record<string, CustomNodeType> = {};

  const nodeRecipe = {} as Record<string, Recipe>;

  const nodeConnections: NodeConnections = {};
  const openConnections: OpenConnections = {
    inputs: {},
    outputs: {},
  };

  const nodeOrder = {} as Record<string, number>;
  nodes.forEach((node, index) => {
    // Annotation nodes don't participate in the solver
    if (node.type !== "recipe-node") return;
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

    const nodeData = {
      recipeId: node.data.recipeId,
      inputs: inputs,
      outputs: outputs,
    } as const;
    
    if (node.data.type === "settlement") {
      nodeConnections[node.id] = {
        ...nodeData,
        options: node.data.options,
        type: "settlement",
      }
    } else if (node.data.type === "thermal-storage") {
      nodeConnections[node.id] = {
        ...nodeData,
        options: node.data.options,
        type: "thermal-storage",
      }
    } else if (node.data.type === "recipe" || node.data.type === "contract") {
      nodeConnections[node.id] = {
        ...nodeData,
        type: "recipe",
        options: node.data.options,
      };
    } else {
      nodeConnections[node.id] = {
        ...nodeData,
        type: node.data.type ?? "recipe",
      };
    }
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

    // Skip edges where the product isn't registered on either side
    const sourceOutputsRegistered = productId in (nodeConnections[edge.source]?.outputs ?? {});
    const targetInputsRegistered = productId in (nodeConnections[edge.target]?.inputs ?? {});
    if (!sourceOutputsRegistered || !targetInputsRegistered) return;

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

/**
 * Determine optional input/output status for a constraint's terms
 * This is pure logic that checks if a constraint has optional inputs and/or outputs
 * 
 * @param terms - Array of constraint terms to analyze
 * @returns Object indicating if constraint has optional inputs/outputs
 */
export function findOptionalTerms(terms: { optional?: boolean; isInput?: boolean }[]): { input: boolean; output: boolean } {
  const initial: { input: boolean; output: boolean } = { input: false, output: false };
  return terms.reduce((acc, t) => {
    if (t.optional) {
      if (t.isInput) acc.input = true;
      else acc.output = true;
    }
    return acc;
  }, initial);
}

/**
 * Calculate infrastructure weight based on key type
 * Different infrastructure types have different costs/importance
 * 
 * @param key - Infrastructure type key
 * @returns Weight multiplier for this infrastructure type
 */
export function getInfrastructureWeight(key: string): number {
  switch (key) {
    case "electricity":
    case "computing":
      return 0.01;
    case "maintenance_2":
      return 10;
    case "maintenance_3":
      return 50;
    default:
      return 1;
  }
}

/**
 * Filter and sort working solutions by proximity to target objective value
 * Used in autoSolve to find the best solution among alternatives
 * 
 * @param solutions - Array of solution candidates with their objective values
 * @param targetValue - Target objective value to compare against (usually previous solution)
 * @returns Sorted array of working solutions, closest to target first
 */
export function filterAndSortSolutions<T extends { solution?: { Status: string; ObjectiveValue: number } | null }>(
  solutions: T[],
  targetValue: number
): T[] {
  return solutions
    .filter(x => x.solution?.Status === "Optimal" && x.solution?.ObjectiveValue !== 0)
    .sort((a, b) => {
      const aObj = Math.abs(targetValue - (a.solution?.ObjectiveValue || 0));
      const bObj = Math.abs(targetValue - (b.solution?.ObjectiveValue || 0));
      return aObj - bObj;
    });
}

/**
 * Check if a constraint should be skipped during autoSolve
 * A constraint is skipped if it or its parent/children are already free
 * 
 * @param constraint - The constraint to check
 * @param freeConstraints - Set of constraint IDs that are already free
 * @returns true if constraint should be skipped
 */
export function shouldSkipConstraint(
  constraint: { unconnected?: boolean; id: string; parent?: string; children?: string[] },
  freeConstraints: Set<string>
): boolean {
  if (constraint.unconnected || freeConstraints.has(constraint.id)) {
    return true;
  }
  
  const parentFree = constraint.parent && freeConstraints.has(constraint.parent);
  if (parentFree) {
    return true;
  }
  
  const childFree = (constraint.children || []).some(c => freeConstraints.has(c));
  if (childFree) {
    return true;
  }
  
  return false;
}
