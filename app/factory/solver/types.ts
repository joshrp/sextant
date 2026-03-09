import type { ProductId, RecipeId } from "../graph/loadJsonData";
import type { SettlementNodeData } from "../graph/nodes/recipeNodeLogic";

export type NodeConnectionBase = {
  recipeId: RecipeId,
  inputs: {
    [k in ProductId]?: { nodeId: string, edgeId: string }[]
  },
  outputs: {
    [k in ProductId]?: { nodeId: string, edgeId: string }[]
  },
};

export type NodeConnectionRecipe = NodeConnectionBase & {
  type: "recipe";
  options?: {
    useRecycling?: boolean;
  };
};

export type NodeConnectionBalancer = NodeConnectionBase & {
  type: "balancer";
};

export type NodeConnectionSettlement = NodeConnectionBase & {
  type: "settlement";
  options: SettlementNodeData["options"];
};

export type NodeConnectionContract = NodeConnectionBase & {
  type: "contract";
  options: undefined;
};

export type NodeConnection = NodeConnectionContract | NodeConnectionRecipe | NodeConnectionBalancer | NodeConnectionSettlement;

export type EqualityTypes = "eq" | "gt" | "lt";

export type NodeConnections = Record<string, NodeConnection>;
export type OpenConnections = {
  inputs: { [k in ProductId]?: string[] },
  outputs: { [k in ProductId]?: string[] }
}

export type FactoryGoal = {
  productId: ProductId,
  qty: number,
  type: "eq" | "lt" | "gt",
  dir: "input" | "output"
};

export type GoalError = {
  productId: ProductId;
  dir: "input" | "output";
  message: string;
};

// Every constraint needs to know what to add and subtract, what item it's for and which nodes they came from
// The constraint "label" in LPP will be the item (+ a uniq), while the nodes will be the variables (the recipe / building)
export type Constraint = {
  id: string,
  productId: ProductId,
  edges: { [k: string]: boolean },
  equality: EqualityTypes,
  unconnected: boolean,
  terms: ({
    nodeId?: string,
    id: string,
    isInput: boolean,
    weight: number,
    optional?: boolean
    value?: number,
    sign: "+" | "-"
  })[],
  parent?: string,
  children: string[]
};

export type GraphScoringMethod = "infra" | "inputs" | "footprint" | "outputs";
export type SolutionStatus = "Solved" | "Running" | "Partial" | "Error" | "Infeasible";

export interface Solution {
  goals: {
    goal: FactoryGoal,
    resultCount: number,
  }[],
  scoringMethod: GraphScoringMethod,
  products: {
    inputs: { productId: ProductId, amount: number }[]
    outputs: { productId: ProductId, amount: number }[]
  },
  nodeCounts: { nodeId: string, count: number }[]
  manifolds: { [constraintId: string]: number },
  infrastructure: {
    workers: number,                   // net (consumed - generated)
    electricity: number,               // net (consumed - generated)
    computing: number,                 // net (consumed - generated)
    maintenance_1: number,             // net (consumed - generated)
    maintenance_2: number,             // net (consumed - generated)
    maintenance_3: number,             // net (consumed - generated)
    footprint: number,
    workers_generated: number,         // total generated (always >= 0)
    electricity_generated: number,     // total generated (always >= 0)
    computing_generated: number,       // total generated (always >= 0)
    maintenance_1_generated: number,   // total generated (always >= 0)
    maintenance_2_generated: number,   // total generated (always >= 0)
    maintenance_3_generated: number,   // total generated (always >= 0)
  },
  ObjectiveValue: number,
}

export type ManifoldOptions = {
  constraintId: string,
  edges: Constraint["edges"],
  free: boolean
}

export type GraphModel = {
  constraints: { [key: string]: Constraint };
  graph: NodeConnections;
  itemConstraints: Map<ProductId, string>;
  nodeIdToLabels: Record<string, string>;
}
