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
    
    const lpp = buildLpp(graph, basicGoals, new Set<string>(), "inputs");
    expect(lpp).toEqual(basicLpp);
  });

  test("Version 2 basic LPP check", async () => {
    const graph = createGraph(initialNodes, initialEdges);
    expect(graph).not.toBeNull();
    
    expect(solve(graph, basicGoals, [], "inputs", false)).not.toBeNull();
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
Maximize
  obj: i_Product_Exhaust+i_Product_SteamHi
Subject To 
  c0: - c0 -24 n_0 +24 n_1 +48 n_2 = 0
  c1: - c1 +24 n_1 -24 n_0 <= 0
  c2: - c2 +48 n_2 -24 n_0 <= 0
  c3: - c3 +12 n_0 -24 n_1 -60 n_3 = 0
  c4: - c4 -24 n_1 +12 n_0 >= 0
  c5: - c5 -60 n_3 +12 n_0 >= 0
  in_workers: - in_workers +4 n_3_int +8 n_1_int +2 n_2_int = 0
  in_electricity: - in_electricity +200 n_3 +200 n_1 = 0
  in_maintenance_1: - in_maintenance_1 +4 n_3 +4 n_1 = 0
  c6: - c6 -12 n_3 +6 n_1 = 0
  o_Product_Acid: - o_Product_Acid +72 n_3 = 0
  i_Product_Exhaust: - i_Product_Exhaust -240 n_1 = 0
  o_Product_CarbonDioxide: - o_Product_CarbonDioxide +96 n_1 = 0
  o_Product_Virtual_PollutedAir: - o_Product_Virtual_PollutedAir +24 n_1 = 0
  in_maintenance_2: - in_maintenance_2 +2 n_2 = 0
  i_Product_SteamHi: - i_Product_SteamHi -48 n_2 = 0
  o_Product_Virtual_MechPower: - o_Product_Virtual_MechPower +12000 n_2 = 0
  n_0_lower: n_0_int - n_0 >= 0
  n_0_upper: n_0_int - n_0 <= 0.99999
  n_1_lower: n_1_int - n_1 >= 0
  n_1_upper: n_1_int - n_1 <= 0.99999
  n_2_lower: n_2_int - n_2 >= 0
  n_2_upper: n_2_int - n_2 <= 0.99999
  n_3_lower: n_3_int - n_3 >= 0
  n_3_upper: n_3_int - n_3 <= 0.99999
Bounds 
  c0 = 0
  c1 = 0
  c2 = 0
  c3 = 0
  c4 = 0
  c5 = 0
  in_workers free
  in_electricity free
  in_maintenance_1 free
  c6 = 0
  o_Product_Acid free
  i_Product_Exhaust free
  o_Product_CarbonDioxide free
  o_Product_Virtual_PollutedAir free
  in_maintenance_2 free
  i_Product_SteamHi free
  o_Product_Virtual_MechPower free
  
  
  n_0_int free
  n_1_int free
  n_2_int free
  n_3_int free
General
  n_0_int
  n_1_int
  n_2_int
  n_3_int
End`
