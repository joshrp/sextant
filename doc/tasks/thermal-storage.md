# Thermal Storage Implementation Plan

## Summary

Model the Thermal Storage building as a **steam-to-steam passthrough with configurable loss**, hiding the intermediate heat product. Three synthetic recipes (LP, HP, SP steam), a new node type with a loss slider (0–100% in steps of 5, default 10%), hard throughput capping at 1800 steam/60s per machine, a help page, and a help link on the node.

### Game Mechanics Recap

The raw game data has 6 recipes in 3 pairs (store/retrieve for LP/HP/SP steam):

| Pair         | Store                        | Retrieve                       | Base Loss |
|-------------|------------------------------|--------------------------------|-----------|
| LP steam    | 1 steam → 9 heat + 1 water  | 10 heat + 1 water → 1 steam   | 10%       |
| HP steam    | 1 steam → 18 heat + 1 water | 20 heat + 1 water → 1 steam   | 10%       |
| SP steam    | 1 steam → 36 heat + 1 water | 40 heat + 1 water → 1 steam   | 10%       |

Round-trip: for every 10 steam stored, 9 steam retrieved + 1 water surplus. That 10% is the base conversion loss. Idle losses in-game increase this further—the slider models that.

### Design Decisions

- **3 synthetic recipes** generated in `reformat.ts` (like balancers/contracts)
- **New node type** `"thermal-storage"` (like settlement/balancer—custom view, dedicated calculator)
- **Hide heat** as intermediate; show as steam→steam + water
- **Keep water** as an output proportional to loss (lost steam condenses to water)
- **Loss slider**: 0–100% in steps of 5, default 10%. At X% loss: output = input × (1 − X/100) steam + input × (X/100) water
- **Throughput**: 1800 units/60s baked into recipe quantities; solver naturally requires multiple machines for higher throughput
- **Help page** explaining mechanism, slider, throughput, and the loss abstraction

---

## Phase 1: Data Layer — Synthetic Recipes in `reformat.ts`

### 1.1 Define thermal storage steam types

Create a constant array of the 3 steam types to generate recipes for:

```typescript
const thermalStorageSteamTypes = [
  { steamId: "Product_SteamLP",  name: "Thermal storage (LP steam)" },
  { steamId: "Product_SteamHi",  name: "Thermal storage (HP steam)" },
  { steamId: "Product_SteamSp",  name: "Thermal storage (SP steam)" },
];
```

### 1.2 Generate synthetic recipes

Add a function `addThermalStorageRecipes()` in `reformat.ts` (follow the pattern of `addContractRecipes()` and the balancer generation loop). For each steam type:

```typescript
const recipeId = `ThermalStorage_${steamId}` as RecipeId;
const recipe: RecipeSerialized = {
  id: recipeId,
  name: name,
  duration: 60,
  origDuration: 60,
  type: "thermal-storage",
  machine: "ThermalStorage" as MachineId,
  inputs: [{ id: steamId as ProductId, quantity: 1800 }],
  outputs: [
    { id: steamId as ProductId, quantity: 1800 },  // base output (loss applied by calculator)
    { id: "Product_Water" as ProductId, quantity: 0 },  // water output (loss applied by calculator)
  ],
  isMaintenance: false,
  isMaintenanceProducer: false,
  isFarm: false,
  usesSolarPower: false,
};
```

**Key design note:** The base recipe has 1800 steam in → 1800 steam out + 0 water. The `ThermalStorageCalculator` (Phase 3) modifies the output quantities based on the loss setting. This matches how `RecipeNodeCalculator` already modifies quantities for recycling/modifiers—the recipe stores the base, the calculator transforms it.

### 1.3 Register recipes on machine and products

- Add each synthetic recipe ID to `machineData.get("ThermalStorage").recipes`
- Add to `product.recipes.input` for the steam product
- Add to `product.recipes.output` for the steam product and for `Product_Water`
- Remove the original 6 `ThermalStorage*` recipe IDs from the machine and product recipe lists (they're replaced by the 3 synthetic ones)

### 1.4 Update `RecipeSerialized.type` to include `"thermal-storage"`

In `loadJsonData.ts` (where `RecipeBase.type` is defined), add `"thermal-storage"` to the union.

### 1.5 Regenerate game data

Run `npm run formatData` after changes. Verify the 3 new recipes appear and the 6 old ones are removed.

---

## Phase 2: Type System

### 2.1 Add `ThermalStorageNodeData` type

In `recipeNodeLogic.ts`, add alongside `RecipeNodeData`, `SettlementNodeData`, etc.:

```typescript
export type ThermalStorageNodeOptions = {
  loss: number; // 0-100, step 5, default 10
};

export type ThermalStorageNodeData = {
  type: "thermal-storage";
  recipeId: RecipeId;
  ltr: boolean;
  alignToDrop?: boolean;
  options: ThermalStorageNodeOptions;
};
```

### 2.2 Update `NodeDataTypes` union

Add `ThermalStorageNodeData` to the `NodeDataTypes` union type so React Flow nodes can carry this data.

### 2.3 Add `NodeConnectionThermalStorage` to solver types

In `solver/types.ts`, add:

```typescript
export type NodeConnectionThermalStorage = NodeConnectionBase & {
  type: "thermal-storage";
  options: ThermalStorageNodeOptions;
};
```

Add to the `NodeConnection` union.

### 2.4 Add reducer for thermal storage options

In `graphReducers.ts`, add `updateThermalStorageOptions()` following the pattern of `updateRecipeNodeOptions()` and `updateSettlementOptions()`.

### 2.5 Add store action

In `store.ts`, expose a `setThermalStorageOptions(nodeId, options)` action that calls the reducer.

---

## Phase 3: Solver Integration

### 3.1 Create `ThermalStorageCalculator`

In `recipeNodeLogic.ts`, add:

```typescript
export const ThermalStorageCalculator = (
  recipe: Recipe,
  nodeOptions: ThermalStorageNodeOptions,
  runCount: number,
  _modifiers: ZoneModifiers
) => {
  const lossFraction = (nodeOptions?.loss ?? 10) / 100;
  return {
    productInput: (productId: ProductId): number => {
      const input = recipe.inputs.find(i => i.product.id === productId);
      if (!input) return 0;
      return input.quantity * runCount;
    },
    productOutput: (productId: ProductId): number => {
      const output = recipe.outputs.find(o => o.product.id === productId);
      if (!output) return 0;
      // Steam output: reduce by loss fraction
      if (productId !== ProductId("Product_Water")) {
        return output.quantity * (1 - lossFraction) * runCount;
      }
      // Water output: proportional to loss (lost steam condenses)
      // Base water quantity in recipe is 0;
      // Use the steam input quantity to derive water
      const steamInput = recipe.inputs[0]?.quantity ?? 0;
      return steamInput * lossFraction * runCount;
    },
  };
};
```

### 3.2 Wire into `getTermOfNode()`

In `solver.ts`, add a branch in `getTermOfNode()`:

```typescript
} else if (node.type === "thermal-storage") {
  const Calculator = ThermalStorageCalculator(recipe, node.options, 1, this.zoneModifiers);
  qty = isInput ? Calculator.productInput(productId) : Calculator.productOutput(productId);
}
```

### 3.3 Wire into `buildNodeConnections()`

In `solverUtils.ts`, add a branch for `"thermal-storage"` that passes `node.data.options` through (like settlement):

```typescript
} else if (node.data.type === "thermal-storage") {
  nodeConnections[node.id] = { ...nodeData, type: "thermal-storage", options: node.data.options };
}
```

### 3.4 Throughput behavior

No additional solver constraints needed — the recipe's 1800 input quantity per 60s duration naturally caps throughput per machine. The solver will assign multiple machines if more throughput is needed. The `_int` variable mechanism already calculates correct building counts.

---

## Phase 4: Node View (UI)

### 4.1 Create `ThermalStorageNodeView.tsx`

A new node view component (pattern from `BalancerNodeView.tsx` / `RecipeNodeView.tsx`):

- **Title bar**: Machine name + `<HelpLink topic="thermal-storage" />`
- **Product handles**: Steam input (left), steam output + water output (right)
- **Loss control**: Stepped slider or `<input type="range">` — 0 to 100, step 5, showing current value as percentage. Default 10%.
- **Display**: Building icon, recipe name (which steam type), current loss %.

The slider calls `setThermalStorageOptions(nodeId, { loss: newValue })` on change, which triggers a re-solve.

### 4.2 Register node view

If thermal storage nodes use the same React Flow `type: 'recipe-node'`, the existing `RecipeNode` component dispatcher needs to route `data.type === "thermal-storage"` to `ThermalStorageNodeView`. Alternatively, register a separate React Flow node type `"thermal-storage-node"` in `nodes/index.ts`.

**Recommendation**: Route within `RecipeNode` (simpler, follows existing pattern where `RecipeNode` already renders different views for `settlement`, `balancer`, `contract`, `recipe`).

### 4.3 Create Cosmos fixture

Create `ThermalStorageNodeView.fixture.tsx` with key states:
- Default (10% loss, LP steam)
- High loss (50%, HP steam)
- Zero loss (0%, SP steam)

---

## Phase 5: Factory Integration

### 5.1 Update `addProductToGraph()`

In `factory.tsx`, add a branch for thermal-storage recipe type:

```typescript
if (recipe.type === "thermal-storage") {
  newNode = {
    id: id + "_" + (new Date().getTime()),
    position,
    type: 'recipe-node',
    data: {
      type: "thermal-storage",
      recipeId: id,
      ltr,
      alignToDrop: recipeAdd.alignToDrop,
      options: { loss: 10 },  // default 10%
    },
  };
}
```

### 5.2 RecipePicker inclusion

Verify the 3 synthetic recipes appear in the recipe picker when searching for thermal storage or for the relevant steam products. The existing search in `RecipePicker` uses the product's recipe lists, so as long as Phase 1.3 registers the recipes on products, they'll appear automatically.

### 5.3 Hydration

Ensure `ThermalStorageNodeOptions` serializes cleanly (it's just `{ loss: number }`, no Map/Set — should be fine). Verify round-trip through IndexedDB persistence.

---

## Phase 6: Help Page

### 6.1 Create `thermal-storage.mdx`

In `app/help/content/`, create a new MDX file explaining:
- What thermal storage does in-game (stores steam as heat)
- How it's modeled here (steam→steam passthrough with loss)
- The loss slider: 0–100%, default 10% matches base game conversion loss
- Increasing loss to model idle/decay losses
- Throughput: 1800 units/60s per building
- Water output: proportional to lost steam (condensate)
- That heat is abstracted away (not shown as an intermediate product)

### 6.2 Register in `helpMetadata.ts`

Add to `helpTopics` array:

```typescript
{
  id: "thermal-storage",
  title: "Thermal Storage",
  description: "How thermal storage buildings are modeled as steam-to-steam conversion with configurable loss.",
  contentKey: "thermal-storage",
  category: "Advanced",
  order: 45,
}
```

### 6.3 Register in `contentLoader.ts`

Import the MDX and add to `contentMap`:

```typescript
import ThermalStorage from './content/thermal-storage.mdx';
// ...
"thermal-storage": ThermalStorage,
```

---

## Phase 7: Testing

### 7.1 Data generation test

In `reformat.test.ts`, add tests verifying:
- 3 synthetic thermal storage recipes are generated
- Original 6 heat-based recipes are removed from machine/product recipe lists
- Each synthetic recipe has correct inputs/outputs/duration
- Recipes are registered on correct products

### 7.2 Solver tests

In `solver.test.tsx`, add snapshot tests:
- Thermal storage node at various loss levels (0%, 10%, 50%)
- Verify correct steam output and water output quantities
- Verify machine count calculation for high-throughput scenarios (e.g., 3600 steam demand → 2 machines)

### 7.3 Calculator unit tests

Test `ThermalStorageCalculator` directly:
- At 0% loss: full steam out, no water
- At 10% loss: 90% steam, 10% water
- At 100% loss: no steam, all water
- Zone modifiers don't affect thermal storage (intentional)

### 7.4 Component fixture

`ThermalStorageNodeView.fixture.tsx` — visual test in Cosmos for the slider and node layout.

### 7.5 Hydration round-trip

Verify thermal storage node data survives IndexedDB persistence (options with loss value).

---

## Implementation Order

1. **Phase 1** (Data Layer) — foundation, everything depends on this
2. **Phase 2** (Types) — enable the node type system-wide
3. **Phase 3** (Solver) — make the math work
4. **Phase 5** (Factory Integration) — nodes can be created and connected
5. **Phase 4** (Node View) — UI for the node + slider
6. **Phase 6** (Help) — documentation
7. **Phase 7** (Testing) — can be done incrementally alongside each phase

---

## Open Questions / Edge Cases

1. **Water product registration**: The water output doesn't exist in the base recipe (quantity 0). Need to verify the solver handles a 0-quantity output that gets dynamically increased by the calculator. If this causes issues, set base water to 1 and have the calculator override.

2. **Recipe search**: The synthetic recipes need to appear when users search for a steam product. Verify `RecipePicker` picks them up from product recipe lists.

3. **Existing factories**: Anyone who placed the old ThermalStorage recipes will have broken node references after the recipe IDs change. Consider migration or keeping old IDs as aliases. The simplest option: if nobody is using this yet (thermal storage wasn't usable before), no migration needed.

4. **Icon**: The ThermalStorage machine should already have an icon in the game data. Verify it renders correctly on the new node view.

5. **Edge connections**: When connecting thermal storage to other nodes, the steam handles should be type-compatible with existing steam producers/consumers. Since the synthetic recipe uses the same `ProductId`, this should work automatically via the existing edge validation.
