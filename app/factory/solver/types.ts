import type { CustomEdgeType } from "../graph/edges";
import type { ProductId, RecipeId } from "../graph/loadJsonData";
import type { CustomNodeType } from "../graph/nodes";

export type NodeConnection = {
  recipeId: RecipeId,
  inputs: {
    [k in ProductId]?: { nodeId: string, edgeId: string }[]
  },
  outputs: {
    [k in ProductId]?: { nodeId: string, edgeId: string }[]
  }
};

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

// Every constraint needs to know what to add and subtract, what item it's for and which nodes they came from
// The constraint "label" in LPP will be the item (+ a uniq), while the nodes will be the variables (the recipe / building)
export type Constraint = {
  id: string,
  productId: ProductId,
  edges: {[k: string]: boolean},
  equality: EqualityTypes,
  unconnected: boolean,
  terms: ({
    nodeId?: string,
    id: string,
    isInput: boolean,
    term: string,
    optional?: boolean
  })[],
  parent?: string,
  children: string[]
};

export interface Solution {
  goals: {
    goal: FactoryGoal,
    resultCount: number,
  }[],
  products: {
    inputs: { productId: ProductId, amount: number }[]
    outputs: { productId: ProductId, amount: number }[]
  },
  nodeCounts: { nodeId: string, count: number }[]
  manifolds: {[constraintId: string]: number},
  infrastructure: {
    workers: number,
    electricity: number,
    computing: number,
    maintenance_1: number,
    maintenance_2: number,
    maintenance_3: number,
    footprint: number,
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
  nodes: CustomNodeType[],
  edges: CustomEdgeType[],
}
