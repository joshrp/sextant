/**
 * Test fixtures for GraphStore state
 * Provides sample graph states for testing reducers
 */
import type { CustomNodeType } from "~/factory/graph/nodeTypes";
import type { CustomEdgeType } from "~/factory/graph/edges";
import type { ProductId, RecipeId } from "~/factory/graph/loadJsonData";
import type { GraphSolutionState } from "~/context/store";

/**
 * Basic graph state with a few nodes and edges
 */
export const basicGraphState: GraphSolutionState = {
  name: "Test Factory",
  nodes: [
    {
      id: "node-1",
      type: "recipe-node",
      position: { x: 0, y: 0 },
      data: { type: "recipe" as const, recipeId: "SteamLpCondensation" as RecipeId, ltr: true },
    },
    {
      id: "node-2",
      type: "recipe-node",
      position: { x: 200, y: 0 },
      data: { type: "recipe" as const, recipeId: "AcidMixMixingT2" as RecipeId, ltr: true },
    },
  ] as CustomNodeType[],
  edges: [
    {
      id: "edge-1",
      source: "node-1",
      target: "node-2",
      sourceHandle: "water" as ProductId,
      targetHandle: "water" as ProductId,
      type: "button-edge",
    },
  ] as CustomEdgeType[],
  goals: [],
  scoringMethod: "infra",
};

/**
 * Empty graph state (no nodes or edges)
 */
export const emptyGraphState: GraphSolutionState = {
  name: "Empty Factory",
  nodes: [],
  edges: [],
  goals: [],
  scoringMethod: "infra",
};
