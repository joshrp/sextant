import { expect, test } from 'vitest'
import Highs, { type Highs as HighsType } from "highs";


import solver, { buildLpp, buildNodeConnections, useHighs } from "./index"

import { initialNodes } from "../graph/nodes";
import { initialEdges } from "../graph/edges";
import { writeFileSync } from 'fs';

const load = (async (url: string) => {
  console.log("Loading Highs from", url);
  return await Highs({ locateFile: (file: string) => url + file });
})("node_modules/highs/build/");

test("solver runs", async () => {  
  const connections = buildNodeConnections(initialNodes, initialEdges);
  const highs = await load;
  const lpp = buildLpp(connections.nodeConnections, connections.openConnections, [{
    dir: "output",
    productId: "acid",
    qty: 48,
    type: "eq"
  },{
    dir: "output",
    productId: "air_pollution",
    qty: 50,
    type: "gt"
  }])

  const runId = new Date().getTime();
  writeFileSync("./runs/"+(runId)+".json", JSON.stringify({
    ...connections,
    ...lpp,
  }, null, 2))
  
  const result = highs.solve(lpp.lpp);
  console.log("Run",runId);
  console.log(lpp.lpp);
  console.log(result.Status);
  if (result.Status == "Optimal") {
    console.log(Object.keys(result.Columns).map(c => {
      const col = result.Columns[c];
      return col.Name + " = " + col.Primal
    }).sort().join('\n'))
  }
})

