import type { ProductId, Recipe } from "../graph/loadJsonData";

export type NodeConnection = {
  recipe: Recipe,
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
  type: EqualityTypes,
  unconnected: boolean,
  terms: ({
    nodeId?: string,
    id: string,
    term: string,
  })[],
};

export type Solution = {
  status: "Solved" | "Infeasible" | "Error",
  errorMessage?: string,
  goals?: {
    goal: FactoryGoal,
    resultCount: number,
  }[],
  products?: {
    inputs: { productId: ProductId, amount: number }[]
    outputs: { productId: ProductId, amount: number }[]
  },
  nodeCounts?: { nodeId: string, count: number }[]
  manifolds?: {[constraintId: string]: number}
}
