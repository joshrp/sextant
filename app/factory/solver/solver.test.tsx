import { expect, test, describe } from 'vitest'
import Highs, { type Highs as HighsType } from "highs";

import { initialNodes } from "../graph/nodes";
import { initialEdges } from "../graph/edges";

import Solver from './solver';
import type { FactoryGoal } from './types';

const load = (async (url: string) => {
  console.log("Loading Highs from", url);
  return await Highs({ locateFile: (file: string) => url + file });
})("node_modules/highs/build/");

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
    const solver = new Solver(initialNodes, initialEdges);
    expect(solver.graph).not.toBeNull();
    
    const lpp = solver.buildLpp(basicGoals);
    expect(lpp).toEqual(basicLpp);
  });

  test("Version 2 basic LPP check", async () => {
    const solver = new Solver(initialNodes, initialEdges);
    expect(solver.graph).not.toBeNull();
    
    expect(solver.solve(await load, basicGoals)).not.toBeNull();
  });

  
});

const basicGoals: FactoryGoal[] = [{
  dir: "output",
  productId: "acid",
  qty: 48,
  type: "eq"
}, {
  dir: "output",
  productId: "air_pollution",
  qty: 48,
  type: "gt"
}];
const basicLpp = `
min
  obj: n_0+n_1+n_2+n_3
subject to 
  c0: - c0 -24 n_0 +24 n_1 +24 n_2 = 0
c1: - c1 +24 n_1 -24 n_0 <= 0
c2: - c2 +24 n_2 -24 n_0 <= 0
c3: - c3 +12 n_0 -24 n_1 -12 n_3 = 0
c4: - c4 -24 n_1 +12 n_0 >= 0
c5: - c5 -12 n_3 +12 n_0 >= 0
c6: - c6 -6 n_3 +6 n_1 = 0
o_acid: - o_acid +24 n_3 = 0
i_exhaust: - i_exhaust -180 n_1 = 0
o_carbon_dioxide: - o_carbon_dioxide +72 n_1 = 0
o_air_pollution: - o_air_pollution +24 n_1 = 0
i_steam_hi: - i_steam_hi -24 n_2 = 0
o_mechanical_power: - o_mechanical_power +6000 n_2 = 0
Bounds 
  c0 = 0
c1 = 0
c2 = 0
c3 = 0
c4 = 0
c5 = 0
c6 = 0
o_acid free
i_exhaust free
o_carbon_dioxide free
o_air_pollution free
i_steam_hi free
o_mechanical_power free
o_acid = 48
o_air_pollution >= 48
end`
