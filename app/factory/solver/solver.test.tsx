import { expect, test, describe } from 'vitest'

import { initialNodes } from "../graph/nodes";
import { initialEdges } from "../graph/edges";

import { buildLpp, createGraph, solve } from './solver';
import type { FactoryGoal } from './types';
import type { ProductId } from '../graph/loadJsonData';

describe("Solver", () => {
  // test("Version 1 basic LPP check", () => {
  //   const connections = buildNodeConnections(initialNodes, initialEdges);
  //   const lpp = buildLpp(connections.nodeConnections, basicGoals)
  //   expect(lpp.lpp).toEqual(basicLpp);
  // });
  // test("Version 1 basic full run", async () => {
  //   const connections = buildNodeConnections(initialNodes, initialEdges);
  //   const highs = await load;
  //   const lpp = buildLpp(connections.nodeConnections, basicGoals)

  //   // const runId = new Date().getTime();
  //   // writeFileSync("./runs/"+(runId)+".json", JSON.stringify({
  //   //   ...connections,
  //   //   ...lpp,
  //   // }, null, 2))

  //   const result = highs.solve(lpp.lpp);

  //   console.log(result.Status);
  //   // expect(result).toStrictEqual(quickTestResult);

  //   if (result.Status == "Optimal") {
  //     console.log(Object.keys(result.Columns).map(c => {
  //       const col = result.Columns[c];
  //       return col.Name + " = " + col.Primal
  //     }).sort().join('\n'))
  //   }
  // });

  test("Version 2 basic LPP check", async () => {
    const graph = createGraph(initialNodes, initialEdges);
    expect(graph).not.toBeNull();
    
    const lpp = buildLpp(graph, basicGoals, new Set<string>());
    expect(lpp).toEqual(basicLpp);
  });

  test("Version 2 basic LPP check", async () => {
    const graph = createGraph(initialNodes, initialEdges);
    expect(graph).not.toBeNull();
    
    expect(solve(graph, basicGoals, [], false)).not.toBeNull();
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
const basicLpp = `
min
  obj: n_0+n_1+n_2+n_3
subject to 
  c0: - c0 -24 n_0 +24 n_1 +48 n_2 = 0
c1: - c1 +24 n_1 -24 n_0 <= 0
c2: - c2 +48 n_2 -24 n_0 <= 0
c3: - c3 +12 n_0 -24 n_1 -60 n_3 = 0
c4: - c4 -24 n_1 +12 n_0 >= 0
c5: - c5 -60 n_3 +12 n_0 >= 0
c6: - c6 -12 n_3 +6 n_1 = 0
o_Product_Acid: - o_Product_Acid +72 n_3 = 0
i_Product_Exhaust: - i_Product_Exhaust -240 n_1 = 0
o_Product_CarbonDioxide: - o_Product_CarbonDioxide +96 n_1 = 0
o_Product_Virtual_PollutedAir: - o_Product_Virtual_PollutedAir +24 n_1 = 0
i_Product_SteamHi: - i_Product_SteamHi -48 n_2 = 0
o_Product_Virtual_MechPower: - o_Product_Virtual_MechPower +12000 n_2 = 0
Bounds 
  c0 = 0
c1 = 0
c2 = 0
c3 = 0
c4 = 0
c5 = 0
c6 = 0
o_Product_Acid free
i_Product_Exhaust free
o_Product_CarbonDioxide free
o_Product_Virtual_PollutedAir free
i_Product_SteamHi free
o_Product_Virtual_MechPower free


end`
