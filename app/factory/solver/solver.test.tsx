import { describe, expect, test } from 'vitest';

import { initialEdges } from "../graph/edges";
import { initialNodes } from "../graph/nodes";

import type { CustomEdgeType } from "../graph/edges";
import type { ProductId, RecipeId } from '../graph/loadJsonData';
import type { RecipeNodeType } from '../graph/nodeTypes';
import { buildLpp, createGraphModel, solve } from './solver';
import type { FactoryGoal } from './types';
import { DEFAULT_ZONE_MODIFIERS } from '~/context/zoneModifiers';

describe("Solver", () => {
  test("Version 2 basic LPP check", async () => {
    const graph = createGraphModel(initialNodes, initialEdges, DEFAULT_ZONE_MODIFIERS);
    expect(graph).not.toBeNull();
    const lpp = buildLpp(graph, basicGoals, new Set<string>(), "inputs");
    expect(lpp).toMatchSnapshot();
  });

  test("Version 2 basic LPP check", async () => {
    const graph = createGraphModel(initialNodes, initialEdges, DEFAULT_ZONE_MODIFIERS);
    expect(graph).not.toBeNull();

    expect(await solve(graph, basicGoals, [], "inputs", false)).not.toBeNull();
  });


});

const basicGoals: FactoryGoal[] = [{
  productId: "acid" as ProductId,
  qty: 48,
  type: "eq"
}, {
  productId: "air_pollution" as ProductId,
  qty: 48,
  type: "gt"
}];

// ---------------------------------------------------------------------------
// Space research — affine station consumption, level-driven by user option
// ---------------------------------------------------------------------------
//
// Station has two regimes (placeholder values from data/reformat.ts).
// Crew is station infrastructure (workers per regime), not a launched product.
// Station node count is pinned at n=1 (level is the user's choice).
// Cargo launches scale continuously: cap_T1=40 cargo/launch.
// Crew launches floor at minRate = 1/24 launches/min.

function launchNode(id: string, recipeId: string, x = 0, y = 0): RecipeNodeType {
  return {
    id,
    type: "recipe-node",
    position: { x, y },
    data: { type: "launch", recipeId: recipeId as RecipeId },
  };
}

function spaceStationNode(id: string, level: number, x = 0, y = 0): RecipeNodeType {
  return {
    id,
    type: "recipe-node",
    position: { x, y },
    data: {
      type: "space-station",
      recipeId: "SpaceStation_Recipe" as RecipeId,
      options: { level },
    },
  };
}

function productEdge(id: string, source: string, target: string, productId: string): CustomEdgeType {
  return {
    id,
    source,
    target,
    sourceHandle: productId,
    targetHandle: productId,
    type: "button-edge",
  } as CustomEdgeType;
}

const CREW_ATSTATION = "Product_Virtual_SpaceCrew_AtStation";

describe("Space research solver", () => {
  test("low cargo demand scales launches continuously (no integer pinning)", async () => {
    const nodes: RecipeNodeType[] = [launchNode("launch1", "Launch_SpaceStationParts1_T1")];
    const goals: FactoryGoal[] = [{
      productId: "Product_Virtual_SpaceStationParts1_AtStation" as ProductId,
      qty: 30, // below cap_T1=40
      type: "gt",
    }];

    const graph = createGraphModel(nodes, [], DEFAULT_ZONE_MODIFIERS);
    const lpp = buildLpp(graph, goals, new Set<string>(), "inputs");
    expect(lpp).toMatchSnapshot();
    const result = await solve(graph, goals, [], "inputs", false);
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;

    // n_launch1 = 30/40 = 0.75 (continuous, one launch every ~80s averaged).
    const count = result.solution.nodeCounts.find(n => n.nodeId === "launch1")?.count ?? 0;
    expect(count).toBeCloseTo(0.75, 3);
  });

  test("high cargo demand scales launches up continuously", async () => {
    const nodes: RecipeNodeType[] = [launchNode("launch1", "Launch_SpaceStationParts1_T1")];
    const goals: FactoryGoal[] = [{
      productId: "Product_Virtual_SpaceStationParts1_AtStation" as ProductId,
      qty: 250, // cap_T1=40, so 250/40 = 6.25 launches/min
      type: "gt",
    }];

    const graph = createGraphModel(nodes, [], DEFAULT_ZONE_MODIFIERS);
    const result = await solve(graph, goals, [], "inputs", false);
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;

    const count = result.solution.nodeCounts.find(n => n.nodeId === "launch1")?.count ?? 0;
    expect(count).toBeCloseTo(6.25, 3);
  });

  test("station node count is pinned at 1 regardless of level", async () => {
    const nodes: RecipeNodeType[] = [spaceStationNode("station1", 5)];
    const goals: FactoryGoal[] = [{
      productId: "Product_Virtual_SpaceResearchPoints" as ProductId,
      qty: 1, // tiny RP goal — LP would otherwise pick n < 1
      type: "gt",
    }];

    const graph = createGraphModel(nodes, [], DEFAULT_ZONE_MODIFIERS);
    const lpp = buildLpp(graph, goals, new Set<string>(), "inputs");
    expect(lpp).toMatchSnapshot();
    const result = await solve(graph, goals, [], "inputs", false);
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;

    const count = result.solution.nodeCounts.find(n => n.nodeId === "station1")?.count ?? 0;
    expect(count).toBe(1);
  });

  test("L1 station consumes basic regime base only (LPP pins coefficients)", async () => {
    const nodes: RecipeNodeType[] = [spaceStationNode("station1", 1)];
    const goals: FactoryGoal[] = [];

    const graph = createGraphModel(nodes, [], DEFAULT_ZONE_MODIFIERS);
    const lpp = buildLpp(graph, goals, new Set<string>(), "inputs");
    expect(lpp).toMatchSnapshot();
    const result = await solve(graph, goals, [], "inputs", false);
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;

    const count = result.solution.nodeCounts.find(n => n.nodeId === "station1")?.count ?? 0;
    expect(count).toBe(1);
  });

  test("L2 station consumes basic base + 1 × basic delta (LPP pins coefficients)", async () => {
    const nodes: RecipeNodeType[] = [spaceStationNode("station1", 2)];
    const goals: FactoryGoal[] = [];

    const graph = createGraphModel(nodes, [], DEFAULT_ZONE_MODIFIERS);
    const lpp = buildLpp(graph, goals, new Set<string>(), "inputs");
    expect(lpp).toMatchSnapshot();
  });

  test("L3 station produces base RP, L=3 → 48 RP (LPP pins advanced-regime base)", async () => {
    const nodes: RecipeNodeType[] = [spaceStationNode("station1", 3)];
    const goals: FactoryGoal[] = [{
      productId: "Product_Virtual_SpaceResearchPoints" as ProductId,
      qty: 48,
      type: "gt",
    }];

    const graph = createGraphModel(nodes, [], DEFAULT_ZONE_MODIFIERS);
    const lpp = buildLpp(graph, goals, new Set<string>(), "inputs");
    expect(lpp).toMatchSnapshot();
    const result = await solve(graph, goals, [], "inputs", false);
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;

    expect(result.solution.goals[0]?.resultCount ?? 0).toBeCloseTo(48, 3);
  });

  test("L5 station produces base + 2 × delta RP = 48 + 96 = 144", async () => {
    const nodes: RecipeNodeType[] = [spaceStationNode("station1", 5)];
    const goals: FactoryGoal[] = [{
      productId: "Product_Virtual_SpaceResearchPoints" as ProductId,
      qty: 144,
      type: "gt",
    }];

    const graph = createGraphModel(nodes, [], DEFAULT_ZONE_MODIFIERS);
    const result = await solve(graph, goals, [], "inputs", false);
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;

    expect(result.solution.goals[0]?.resultCount ?? 0).toBeCloseTo(144, 3);
  });

  test("Crew launch is floor-bound at low demand (L3 + T2 crew launch)", async () => {
    // L3 crew = 4. T2 carries 12, so ceil(4/12) = 1 launch/cycle — but the floor of
    // 1 launch/cycle would bind anyway. n = 1/24. The over-delivery (12 vs 4) is sunk
    // via the launch's optional crew output.
    const nodes: RecipeNodeType[] = [
      spaceStationNode("station1", 3),
      launchNode("crew_launch", "Launch_Crew_T2"),
    ];
    const edges = [productEdge("crew_edge", "crew_launch", "station1", CREW_ATSTATION)];
    const goals: FactoryGoal[] = [{
      productId: "Product_Virtual_SpaceResearchPoints" as ProductId,
      qty: 1,
      type: "gt",
    }];

    const graph = createGraphModel(nodes, edges, DEFAULT_ZONE_MODIFIERS);
    const lpp = buildLpp(graph, goals, new Set<string>(), "inputs");
    expect(lpp).toMatchSnapshot();
    const result = await solve(graph, goals, [], "inputs", false);
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;

    const launchCount = result.solution.nodeCounts.find(n => n.nodeId === "crew_launch")?.count ?? 0;
    expect(launchCount).toBeCloseTo(1 / 24, 4);
  });

  test("Crew launch quantizes to whole launches per cycle (6 crew, T1 cap 4 → 2 launches)", async () => {
    // L4 advanced regime crew = 4 + 1×2 = 6. T1 carries 4 crew, so a single launch can't
    // replace the whole crew — ceil(6/4) = 2 whole launches per 24-month cycle. The launch
    // rate must be an integer multiple of 1/24, so n = 2/24, not the continuous 6/96 = 1.5/24.
    const nodes: RecipeNodeType[] = [
      spaceStationNode("station1", 4),
      launchNode("crew_launch", "Launch_Crew_T1"),
    ];
    const edges = [productEdge("crew_edge", "crew_launch", "station1", CREW_ATSTATION)];
    const goals: FactoryGoal[] = [{
      productId: "Product_Virtual_SpaceResearchPoints" as ProductId,
      qty: 1,
      type: "gt",
    }];

    const graph = createGraphModel(nodes, edges, DEFAULT_ZONE_MODIFIERS);
    const lpp = buildLpp(graph, goals, new Set<string>(), "inputs");
    expect(lpp).toMatchSnapshot();
    const result = await solve(graph, goals, [], "inputs", false);
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;

    const launchCount = result.solution.nodeCounts.find(n => n.nodeId === "crew_launch")?.count ?? 0;
    expect(launchCount).toBeCloseTo(2 / 24, 4);
  });

  test("Crew launch scales by demand at high station level (L20, T2 → 4 launches)", async () => {
    // L20 crew = 4 + 17×2 = 38. T2 carries 12, ceil(38/12) = 4 whole launches/cycle.
    // Integer quantization rounds the continuous 38/12 ≈ 3.17 up to 4. n = 4/24.
    const nodes: RecipeNodeType[] = [
      spaceStationNode("station1", 20),
      launchNode("crew_launch", "Launch_Crew_T2"),
    ];
    const edges = [productEdge("crew_edge", "crew_launch", "station1", CREW_ATSTATION)];
    const goals: FactoryGoal[] = [{
      productId: "Product_Virtual_SpaceResearchPoints" as ProductId,
      qty: 1,
      type: "gt",
    }];

    const graph = createGraphModel(nodes, edges, DEFAULT_ZONE_MODIFIERS);
    const result = await solve(graph, goals, [], "inputs", false);
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;

    const launchCount = result.solution.nodeCounts.find(n => n.nodeId === "crew_launch")?.count ?? 0;
    expect(launchCount).toBeCloseTo(4 / 24, 4);
  });
});
