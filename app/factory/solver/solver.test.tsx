import { describe, expect, test } from 'vitest';

import { initialEdges } from "../graph/edges";
import { initialNodes } from "../graph/nodes";

import type { ProductId } from '../graph/loadJsonData';
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
