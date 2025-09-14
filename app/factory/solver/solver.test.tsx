import { expect, test, describe } from 'vitest'

import { initialNodes } from "../graph/nodes";
import { initialEdges } from "../graph/edges";

import { buildLpp, createGraph, solve } from './solver';
import type { FactoryGoal } from './types';
import type { ProductId } from '../graph/loadJsonData';

describe("Solver", () => {
  test("Version 2 basic LPP check", async () => {
    const graph = createGraph(initialNodes, initialEdges);
    expect(graph).not.toBeNull();
    const lpp = buildLpp(graph, basicGoals, new Set<string>(), "inputs");
    expect(lpp).toMatchSnapshot();
  });

  test("Version 2 basic LPP check", async () => {
    const graph = createGraph(initialNodes, initialEdges);
    expect(graph).not.toBeNull();
    
    expect(await solve(graph, basicGoals, [], "inputs", false)).not.toBeNull();
  });

  
});

const basicGoals: FactoryGoal[] = [{
  dir: "output",
  productId: "acid" as ProductId,
  qty: 48,
  type: "eq"
}, {
  dir: "output",
  productId: "air_pollution" as ProductId,
  qty: 48,
  type: "gt"
}];
