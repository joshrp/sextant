# Solver

The solver turns a graph of recipe nodes into an LP problem, hands it to HiGHS.js, and writes the solution back onto the graph. This README captures the idioms and gotchas that aren't obvious from reading `solver.ts` cold — read it before designing any feature that touches the LP.

## Pipeline

```
GraphModel ──► buildLpp() ──► LP string ──► solveWithHighs() ──► HighsSolution
                                                                       │
                                              applyToGraph(solution) ◄─┘
```

- `buildLpp` (`solver.ts`) serializes the graph to the CPLEX LP file format.
- Each node gets a label `n_X` (continuous, ≥ 0). Every product flow on the graph becomes a term in a constraint.
- The solver runs once per score method (`infra`, `inputs`, `footprint`, `outputs`) and the best solution is kept.

## The `_int` companion variable pattern

**This is the most important idiom in the file.** Every node has an integer-ceiling companion variable in the LP — you don't need to build MILP machinery, just opt terms in.

```
n_X        : continuous, ≥ 0 (the node's recipe multiplier)
n_X_int    : integer, declared in `General` section
n_X_lower  : n_X_int - n_X >= 0           ┐  together: n_X_int = ceil(n_X)
n_X_upper  : n_X_int - n_X <= 0.99999     ┘
```

Generated for **every node** in `buildLpp` (search for `integerNodes`). The continuous `n_X` participates in product flow as usual; the integer `n_X_int` is available any time you want a term to round up.

### How to use it

In `getTermOfNode`, return the term against `n_X_int` instead of `n_X` whenever the recipe's input/output should be ceiling'd. Today this is wired to:

- **Workers** — staffing rounds up to whole employees.
- **Footprint** — buildings round up to whole units.

To opt a new term in: add a flag on the recipe term (e.g. `integerScale?: true`) and branch in `getTermOfNode`'s return:

```ts
return {
  id: recipeItem.integerScale
    ? this.getNodeLabel(nodeId) + "_int"
    : this.getNodeLabel(nodeId),
  // ...
};
```

That single conditional opts an arbitrary set of product flows into integer-ceiling behavior. **No MILP plumbing needs to be added** — the companion variables and ceil constraints are already in every LP.

### When NOT to use `_int`

- When fractional values are physically meaningful (continuous flows, throughput rates). Ceiling them inflates demand artificially.
- When the downstream side of a connection must match exactly. `n_X_int` is ≥ `n_X`, so wiring it in over-supplies. Use the continuous `n_X` on the demand side and the integer companion only where overhead is real (e.g. discrete rocket cost on a launch input, not on the cargo flow).

### History

A previous integer solution existed before the `_int` companion variables; the current pattern is the keep-it. If you're tempted to add a two-pass solve, feedback calculator, or new MILP variables for a new "discrete" requirement, stop — almost certainly `_int` already covers it.

## What's in the LP vs display-only

The LP optimizes **per-minute flows and rates**. One-time and aesthetic costs are not in the LP.

In the LP:

- Product flows (inputs, outputs per recipe term).
- Worker consumption.
- Footprint.
- Item constraints from goals.

Display-only (calculated and rendered, but never a constraint):

- `machine.buildCosts` — multiplied by the recipe's solution multiplier at render time to show construction cost. Linear in multiplier. Adding a "construction cost" to the LP would conflate one-time and per-minute units and is asymmetric with every other machine; don't do it.
- Maintenance modifiers, recycling efficiency, farm yield, etc. — applied inside the calculators (`recipeNodeLogic.ts`) to the per-minute quantities before they reach the LP. The LP sees post-modifier quantities.

Rule of thumb: if the unit is "X per minute," it can go in the LP. If it's "X total" or "X multiplier on a flow," it shouldn't.

## Calculator switch

`getTermOfNode` dispatches to a per-recipe-type calculator (`solver.ts`, around the `node.type === …` block):

| `node.type` | Calculator |
|---|---|
| `"settlement"` | `SettlementCalculator` |
| `"thermal-storage"` | `ThermalStorageCalculator` |
| `"recipe"` / `"contract"` | `RecipeNodeCalculator` |
| `"balancer"` | none (terms come from balancer-specific synthesis) |

The calculators live in `app/factory/graph/nodes/recipeNodeLogic.ts`. Each returns `{ productInput(id), productOutput(id) }` for the recipe at `runCount = 1`; the LP multiplier scales them.

## Adding a new recipe type

Adding a new value to the recipe `type` union (e.g. `"space-station"`, `"launch"`) is a coordinated edit across:

1. `app/factory/graph/loadJsonData.ts` — extend `RecipeSerialized["type"]`.
2. `app/factory/graph/nodes/recipeNodeLogic.ts` — add a `NodeData` subtype, extend `NodeBaseData["type"]` and `NodeDataTypes` union. Add a `<Type>Calculator` if the math differs from `RecipeNodeCalculator`.
3. `app/factory/solver/solver.ts` — add the case to the calculator switch in `getTermOfNode`.
4. The React Flow node-type registry — register the rendering component.
5. `data/reformat.ts` — usually the new type is synthesized here (see "Synthesized recipes" below).

Skipping any of these silently leaves the type behaving like a plain `"recipe"` in some places and unrenderable in others. Search for the existing `"thermal-storage"` mentions for a complete worked example.

## Synthesized recipes

Many features add no raw game data — they synthesize recipes and machines in `data/reformat.ts`. Examples: `addContractRecipes`, `addThermalStorageRecipes`, the balancer machine. The pattern:

- Mint synthetic machine(s).
- Mint synthetic product(s), including `Product_Virtual_*` for non-physical concepts (workers, research points, in-transit cargo). Virtual products without a real game counterpart prevent the LP from cancelling out feedback loops.
- Mint recipes that wire the synthetic machine to real and virtual products.
- Stamp them with a recipe `type` so the calculator switch dispatches correctly.

Run `npm run formatData` after edits to regenerate `app/gameData.ts`.

## Variable naming gotcha

**Never create LP variables starting with `inf`.** HiGHS's LP parser treats `inf` as a reserved bound and throws. This catches you out if you autogenerate names from product or node IDs that begin with "infra", "info", etc.

## Score methods

`infra`, `inputs`, `footprint`, `outputs` — see `buildLpp`. They share the same constraints but differ in objective. The solver runs all of them and picks the most useful result. New score methods need both an objective (the `Minimize` / `Maximize` line) and a way to interpret the solution.

## Debugging

- `debug(lpp)` in `getHighsSolution` logs the full LP string. Pipe it into a HiGHS CLI run if you want to bisect constraint feasibility outside the browser.
- The 2-second timeout will mask infinite loops in pathological LPs; a debug LP that hangs the browser usually means a cycle without a sink.
- Infeasibility surfaces via `freeConstraints` retry logic — see the bisection TODO at the top of `getHighsSolution` for the long-term plan.
