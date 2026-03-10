/**
 * Pure reducer functions for GraphStore actions
 * These functions transform state immutably and can be tested independently
 */
import type { ButtonEdgeData } from "~/factory/graph/edges/ButtonEdge";
import type { GraphSolutionState, GraphStore } from "~/context/store";
import type { ProductionZoneStoreData } from "~/context/ZoneStore";
import type { GoalError, GraphScoringMethod, ManifoldOptions, GraphModel, FactoryGoal } from "~/factory/solver/types";
import type { solve } from "~/factory/solver/solver";
import type { NodeDataTypes, RecipeNodeData, SettlementNodeData, ThermalStorageNodeData } from "~/factory/graph/nodes/recipeNodeLogic";
import { isRecipeNode } from "~/factory/graph/nodeTypes";

/**
 * Update data for a specific node immutably
 * @param state Current graph state
 * @param nodeId ID of the node to update
 * @param data Partial data to merge into the node
 * @returns New state with updated node
 */
export function updateNodeData(
  state: GraphSolutionState,
  nodeId: string,
  data: Partial<NodeDataTypes>
): GraphSolutionState {
  return {
    ...state,
    nodes: state.nodes.map(node =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, ...data } as NodeDataTypes }
        : node
    ),
  };
}

export function updateSettlementOptions(
  state: GraphSolutionState,
  nodeId: string,
  options?: Partial<SettlementNodeData["options"]>
): GraphSolutionState {
  return {
    ...state,
    nodes: state.nodes.map(node =>
      node.id === nodeId && isRecipeNode(node) && node.data.type === "settlement"
        ? { ...node, data: { ...node.data, options: { ...node.data.options, ...options } } }
        : node
    ),
  };
}

export function updateRecipeNodeOptions(
  state: GraphSolutionState,
  nodeId: string,
  options?: Partial<RecipeNodeData["options"]>  
): GraphSolutionState {
  return {
    ...state,
    nodes: state.nodes.map(node =>
      node.id === nodeId && isRecipeNode(node) && node.data.type === "recipe"
        ? {
          ...node,
          data: {
            ...node.data,
            options: { ...node.data.options, ...options },
          },
        }
        : node
    ),
  };
}

export function updateThermalStorageOptions(
  state: GraphSolutionState,
  nodeId: string,
  options?: Partial<ThermalStorageNodeData["options"]>
): GraphSolutionState {
  return {
    ...state,
    nodes: state.nodes.map(node =>
      node.id === nodeId && isRecipeNode(node) && node.data.type === "thermal-storage"
        ? { ...node, data: { ...node.data, options: { ...node.data.options, ...options } } }
        : node
    ),
  };
}


/**
 * Update data for a specific edge immutably
 * @param state Current graph state
 * @param edgeId ID of the edge to update
 * @param data Partial data to merge into the edge
 * @returns New state with updated edge
 */
export function updateEdgeData(
  state: GraphSolutionState,
  edgeId: string,
  data: Partial<ButtonEdgeData>
): GraphSolutionState {
  return {
    ...state,
    edges: state.edges.map(edge =>
      edge.id === edgeId
        ? { ...edge, data: { ...edge.data, ...data } }
        : edge
    ),
  };
}

/**
 * Clone nodes and edges arrays (for React Flow refresh)
 * @param state Current graph state
 * @returns New state with cloned arrays
 */
export function cloneNodesEdges(state: GraphSolutionState): GraphSolutionState {
  return {
    ...state,
    nodes: [...state.nodes],
    edges: [...state.edges],
  };
}

/**
 * Update scoring method
 * @param state Current graph state
 * @param method New scoring method
 * @returns New state with updated scoring method
 */
export function updateScoringMethod(
  state: GraphSolutionState,
  method: GraphScoringMethod
): GraphSolutionState {
  return {
    ...state,
    scoringMethod: method,
  };
}

/**
 * Update base weights if they have changed
 * @param state Current graph state (with baseWeights property)
 * @param weights New weights to set
 * @returns New state with updated weights, or same state if weights unchanged
 */
export function updateBaseWeights<T extends { baseWeights: ProductionZoneStoreData["weights"] }>(
  state: T,
  weights: ProductionZoneStoreData["weights"]
): T {
  // Only update if weights have actually changed (reference equality check)
  if (state.baseWeights !== weights) {
    return {
      ...state,
      baseWeights: weights,
    };
  }
  return state;
}

export type SolutionUpdateStateInputs = {
  graph?: GraphSolutionState["graph"];
  manifoldOptions?: GraphStore["manifoldOptions"];
  solution?: GraphSolutionState["solution"];
  goals: GraphSolutionState["goals"];
  scoringMethod: GraphSolutionState["scoringMethod"];
};

export type SolutionUpdateStateOutputs = {
  solution?: GraphSolutionState["solution"];
  solutionStatus?: GraphSolutionState["solutionStatus"];
  manifoldOptions?: GraphStore["manifoldOptions"];
  goalErrors?: GoalError[];
};

/**
 * Validate that goals don't conflict with the graph's open connections.
 * An output goal requires an open output constraint (o_ prefix) for that product.
 * An input goal requires an open input constraint (i_ prefix) for that product.
 * If a goal's direction conflicts with the constraint direction, the LP would be infeasible.
 */
export function validateGoals(graph: GraphModel, goals: FactoryGoal[]): GoalError[] {
  const errors: GoalError[] = [];
  for (const goal of goals) {
    const constraintId = graph.itemConstraints.get(goal.productId);
    if (!constraintId) continue; // product not in graph open connections

    const isInputConstraint = constraintId.startsWith('i_');
    const isOutputConstraint = constraintId.startsWith('o_');

    if (goal.qty >= 0 && isInputConstraint) {
      errors.push({
        productId: goal.productId,
        message: "This goal's product has an open connection as an input somewhere in the factory",
      });
    }
    if (goal.qty < 0 && isOutputConstraint) {
      errors.push({
        productId: goal.productId,
        message: "This goal's product has an open connection as an output somewhere in the factory",
      });
    }
  }
  return errors;
}

export async function solutionUpdateAction<T extends SolutionUpdateStateInputs>({
  state, solver, autoSolve = true
}: {
  state: T;
  solver: typeof solve;
  autoSolve?: boolean;
}): Promise<SolutionUpdateStateOutputs> {
  if (!state.graph) return {};

  // Validate goals against the graph before solving
  const goalErrors = validateGoals(state.graph, state.goals);
  if (goalErrors.length > 0) {
    return { solutionStatus: "Error", goalErrors, solution: undefined };
  }

  const resp: SolutionUpdateStateOutputs = { solutionStatus: "Running", goalErrors: [] };

  const manifoldOptions = state.manifoldOptions || [];
  let previousSolutionValue: number | undefined = undefined;
  if (state.solution && state.solution.scoringMethod === state.scoringMethod) {
    previousSolutionValue = state.solution.ObjectiveValue;
  }
  const result = await solver(state.graph, state.goals, manifoldOptions, state.scoringMethod, autoSolve, previousSolutionValue);
  if (result === "Error" || result === "Infeasible") {
    return { solutionStatus: result };
  }

  let status: GraphSolutionState["solutionStatus"] = "Solved";
  if (manifoldOptions.length > 0)
    status = "Partial";

  resp.solution = result.solution;
  resp.solutionStatus = status;
  console.log('Got solver status:', resp.solutionStatus, 'with manifolds:', manifoldOptions.length, 'and solution value:', resp.solution?.ObjectiveValue);
  if (result.manifolds) {
    resp.manifoldOptions = result.manifolds;
  }

  return resp;
}

export type ValidateManifoldsInputs = {
  manifoldOptions: ManifoldOptions[];
  graph?: GraphModel;
};

export type ValidateManifoldsOutputs = {
  manifoldOptions: ManifoldOptions[];
};

/**
 * Validate and update manifold options based on current graph constraints
 * 
 * This function:
 * 1. Filters out manifolds that are not free (free === false)
 * 2. Validates that each manifold's constraint still exists in the graph
 * 3. Checks if the manifold's edges match the constraint's edges
 * 4. If edges don't match, searches for a matching constraint and updates the manifold
 * 5. Removes manifolds that can't be validated or matched
 * 
 * @param inputs - Object containing manifoldOptions and optional graph
 * @returns Object containing validated and updated manifoldOptions array
 */
export function validateManifolds({
  manifoldOptions,
  graph,
}: ValidateManifoldsInputs): ValidateManifoldsOutputs {
  if (!graph) {
    // No graph means we can't validate, return empty array
    return { manifoldOptions: [] };
  }

  // Helper function to check if two sets are equal
  const setsAreEqual = (set1: Set<string>, set2: Set<string>): boolean => {
    if (set1.size !== set2.size) return false;
    for (const item of set1) {
      if (!set2.has(item)) return false;
    }
    return true;
  };

  const validatedManifolds = manifoldOptions
    .map(man => {
      // Filter out non-free manifolds
      if (man.free === false) return null;

      // Check if the constraint still exists
      const constraint = graph.constraints[man.constraintId];
      if (constraint === undefined) return null;

      // Check if edges match
      const constraintEdges = new Set(Object.keys(constraint.edges));
      const manifoldEdges = new Set(Object.keys(man.edges));
      
      // If edges match exactly, keep the manifold as-is
      if (setsAreEqual(constraintEdges, manifoldEdges)) {
        return man;
      }

      // Edges don't match - search for a constraint that matches the manifold's edges
      const otherMatch = Object.keys(graph.constraints).find(id => {
        const edges = graph.constraints[id].edges;
        return edges && setsAreEqual(new Set(Object.keys(edges)), manifoldEdges);
      });

      // If we found a matching constraint, update the manifold
      if (otherMatch) {
        return {
          constraintId: otherMatch,
          edges: man.edges,
          free: man.free,
        };
      }

      // No match found, remove this manifold
      return null;
    })
    .filter((x): x is ManifoldOptions => x !== null);

  return { manifoldOptions: validatedManifolds };
}
  
// ============================================================================
// TODOs: Complex actions requiring significant refactoring
// ============================================================================

/*
 * TODO: React Flow Integration Actions
 * 
 * The following actions are tightly coupled to React Flow utilities and would
 * require extracting an adapter layer:
 * 
 * - addNode: Uses React Flow's state and triggers graphUpdateAction()
 *   Refactor approach: Create a pure addNodeToGraph(state, node) that returns
 *   new state, then the store action calls it + triggers side effects
 * 
 * - removeNode: Uses getConnectedEdges() from React Flow
 *   Refactor approach: Extract edge connection logic to pure function
 *   findConnectedEdges(nodes, edges, nodeId) => edgeIds[]
 * 
 * - addEdge: Uses React Flow's addEdge() utility
 *   Refactor approach: Implement pure addEdgeToGraph(state, connection) that
 *   creates proper edge object with all required properties
 * 
 * - onNodesChange/onEdgesChange: Direct React Flow handlers using
 *   applyNodeChanges/applyEdgeChanges utilities
 *   Refactor approach: Wrap React Flow utilities in pure functions that take
 *   state + changes and return new state
 * 
 * - onConnect: React Flow connection handler
 *   Refactor approach: Extract connection validation and edge creation logic
 */

/*
 * TODO: Async Solver Actions
 * 
 * These actions involve complex async solver operations:
 * 
 * - graphUpdateAction: Creates graph model via createGraphModel() and triggers
 *   solver. Also calls validateManifolds()
 *   Refactor approach: Extract pure graph model creation, make solver interface
 *   testable, separate state updates from solver calls

 */

/*
 * TODO: Validation and Constraint Logic
 * 
 * These involve complex graph validation with Set operations:
 * 
 * - setManifold: Manages manifold options with constraint mapping
 *   Refactor approach: Extract addManifold(state, constraints) and
 *   removeManifold(state, constraints) pure functions
 */

/*
 * TODO: Import/Export
 * 
 * - importData: Multi-step transformation from import format to graph state,
 *   then triggers graphUpdateAction()
 *   Refactor approach: Extract transformImportData(importData) => GraphCoreData
 *   as pure function, separate from state setting and solver trigger
 */
