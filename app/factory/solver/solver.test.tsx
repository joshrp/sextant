import { expect, test } from 'vitest'


import solver, { buildLpp, buildNodeConnections, useHighs } from "./index"

import { initialNodes } from "../graph/nodes";
import { initialEdges } from "../graph/edges";


test("solver runs", () => {
  const exp = `
minimize
  obj: exhaust+steam_hi
subject to
    
      \\c0: steam_lo
      c0: -24 n_0 +24 n_1 +24 n_2 = 0
    
      \\c1: water
      c1: +12 n_0 -24 n_1 -12 n_3 = 0
    
      \\c2: sulfur
      c2: -6 n_3 +6 n_1 = 0
    
      \\c4: acid
      c4: acid-24 n_3 = 0
    
      \\c5: exhaust
      c5: exhaust-180 n_1 = 0
    
      \\c8: carbon_dioxide
      c8: carbon_dioxide-72 n_1 = 0
    
      \\c10: air_pollution
      c10: air_pollution-24 n_1 = 0
    
      \\c11: steam_hi
      c11: steam_hi-24 n_2 = 0
    
      \\c12: mechanical_power
      c12: mechanical_power-6000 n_2 = 0
    

      \\n_0: lo-press_steam_condensation

      \\n_1: exhaust_filtering_1

      \\n_2: turbinehighpress

      \\n_3: acid_mixing_1
Bounds 
  0 <= exhaust
  0 <= steam_hi
  acid >= 48
end`;
  const connections = buildNodeConnections(initialNodes, initialEdges);
  console.log('using connections', connections);
  const res = buildLpp(connections, {
    acid: {
      qty: 48
    }
  })

  expect(res.lpp.split('\n')).toEqual(exp.split('\n'));
})
