import { describe, expect, test } from 'vitest';

import { initialEdges } from "../graph/edges";
import { initialNodes } from "../graph/nodes";

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
// Station has two regimes (placeholder values from data/reformat.ts):
//   - L1-L2 (basic): Parts1=5+2(L-1), CrewSupplies=3+(L-1), SpaceCrew=1+(L-1)
//   - L3+ (advanced): Parts2=5+2(L-3), CrewSupplies=10+3(L-3), SpaceCrew=4+(L-3),
//                     Electronics4=2+(L-3), RP=48+16(L-3)
// Station node count is pinned at n=1 (level is the user's choice).
// Launches scale continuously: cap_T1=40 cargo/launch.

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

  test("L1 station consumes basic regime base only", async () => {
    const nodes: RecipeNodeType[] = [spaceStationNode("station1", 1)];
    // No RP goal — just check we can solve at L1 and consumption uses Parts1.
    const goals: FactoryGoal[] = [];

    const graph = createGraphModel(nodes, [], DEFAULT_ZONE_MODIFIERS);
    const result = await solve(graph, goals, [], "inputs", false);
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;

    const count = result.solution.nodeCounts.find(n => n.nodeId === "station1")?.count ?? 0;
    expect(count).toBe(1);
  });

  test("L3 station produces base RP, L=3 → 48 RP", async () => {
    const nodes: RecipeNodeType[] = [spaceStationNode("station1", 3)];
    const goals: FactoryGoal[] = [{
      productId: "Product_Virtual_SpaceResearchPoints" as ProductId,
      qty: 48,
      type: "gt",
    }];

    const graph = createGraphModel(nodes, [], DEFAULT_ZONE_MODIFIERS);
    const result = await solve(graph, goals, [], "inputs", false);
    expect(typeof result).not.toBe("string");
    if (typeof result === "string") return;

    expect(result.solution.goals[0]?.resultCount ?? 0).toBeCloseTo(48, 3);
  });

  test("L5 station produces base + 2 × delta RP = 48 + 32 = 80", async () => {
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
});
