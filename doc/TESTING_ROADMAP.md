# COI Calculator - Testing Implementation Roadmap

## Overview
This document outlines isolated testing tasks prioritized by complexity and risk. Each task includes refactoring, review, and test implementation phases to ensure quality coverage as the MVP evolves.

## Agent Startup (Read First)
When starting a testing task, read these docs in order:
1. `doc/TESTING_TASKS_SUMMARY.md`
2. `doc/TESTING_ROADMAP.md`
3. `doc/COMPONENT_TESTING.md`
4. `doc/E2E_TESTING.md`

## Testing Tool Stack
- **Vitest** - Unit tests (pure functions, business logic) - Already configured
- **@testing-library/react** - Component tests (user interactions) - Configured (jsdom suite)
- **Playwright** - E2E smoke tests (critical paths only, 2-3 tests max) - Configured (baseline specs)

## Time Estimate Legend

Each task shows two time estimates:
- **👤 Experienced Dev** - Developer familiar with codebase, tools, and testing patterns
- **🤖 AI Agent** - Agent with context about codebase but may need iteration/debugging

Multiplier: Agents typically take 1.5-3x longer due to:
- Need for validation/review cycles
- Tool learning (Playwright usage, testing-library patterns)
- Debugging without immediate feedback
- Conservative iteration (smaller changes, more verification)

---

## 🔴 CRITICAL TASK 1: Expand Solver Test Coverage

**Tool:** Vitest  
**Time:** 👤 2-4 hours | 🤖 4-8 hours  
**Dependencies:** None (extends existing `app/factory/solver/solver.test.tsx`)

### What This Covers
The linear programming solver is the core of the app. While basic tests exist, edge cases around circular dependencies, disconnected graphs, and constraint generation need coverage.

### Phase 1: Review Current Coverage
👤 30 min | 🤖 1 hour
- Run existing `solver.test.tsx` with coverage: `npm test -- --coverage`
- Identify gaps in:
  - Circular recipe dependencies
  - Disconnected graph components
  - Invalid/missing recipe data
  - Each scoring method (`infra`, `inputs`, `footprint`, `outputs`)
- Document findings in test file comments

### Phase 2: Add Test Fixtures
👤 1 hour | 🤖 2 hours
- Create `app/test/fixtures/graphs.ts` with pre-built graph configurations:
  - Simple chain (A → B → C)
  - Diamond (A → B+C → D)
  - Circular (A → B → A)
  - Disconnected (A → B, C → D with no connection)
  - Single node (no edges)
- Use real recipe IDs from `gameData.ts` (e.g., `ironSmeltingScrap`, `copperSmeltingScrap`)
- Follow existing `testFactories.json` structure for consistency

### Phase 3: Implement Tests
👤 1-2 hours | 🤖 2-4 hours
- Add snapshot tests for each fixture's LPP output (use `toMatchSnapshot()`)
- Test all four scoring methods on same graph - verify different solutions
- Verify constraint counts match expected (equality, inequality, loop closures)
- Test timeout behavior (graphs that can't solve in 2s)
- Test invalid inputs (missing recipes, null edges, empty graphs)
- Follow existing test patterns in `solver.test.tsx`

**Success Criteria:**
- 20+ test cases covering edge cases
- All scoring methods tested on multiple graphs
- Snapshot coverage of constraint generation
- All tests pass in < 5 seconds

**Agent Notes:**
- Run tests frequently: `npm test -- solver`
- Validate snapshots manually before committing
- If snapshot fails, check if change is expected or bug
- HiGHS solver timeout is 2000ms - don't change this

---

## 🔴 CRITICAL TASK 2: Import/Export Round-Trip Testing

**Tool:** Vitest  
**Time:** 👤 3-4 hours | 🤖 5-8 hours  
**Dependencies:** None

### What This Covers
Data loss prevention during factory save/load. Base85 encoding, compression, and version migration must be bulletproof.

### Phase 1: Refactor for Testability
👤 1 hour | 🤖 2 hours

Extract pure functions from `app/factory/importexport/importexport.ts`:

```typescript
// Create: app/factory/importexport/encoder.ts
export function encodeFactoryState(state: MinimalGraphState): string {
  // Move encoding logic from encodeFactory() - pure function
  // Input: MinimalGraphState, Output: base85 string
}

export function decodeFactoryState(encoded: string): MinimalGraphState {
  // Move decoding logic from decodeFactory() - pure function with error handling
  // Input: base85 string, Output: MinimalGraphState or throw error
}

// Update: app/factory/importexport/importexport.ts
// Use new functions, keeping existing public API unchanged
```

**Agent Notes:**
- Do NOT change `encodeFactory()` / `decodeFactory()` signatures
- Extract logic only - preserve exact behavior
- Test refactor doesn't break existing usage
- Run `npm test` to verify no regressions

### Phase 2: Create Test Fixtures
👤 1 hour | 🤖 2 hours

- Use existing `testExports.json` as baseline
- Add edge cases to `app/test/fixtures/exports.ts`:
  - Empty factory (no nodes/edges)
  - Large factory (100+ nodes) - stress test
  - Special characters in names/goals
  - All node types: `recipe`, `storage`, `byproduct`, `constant`
  - All edge types: normal, byproduct, different manifolds
  - Freed vs non-freed manifolds
  - Mix of all scoring methods

**Agent Notes:**
- Use real recipe IDs from `gameData.ts`
- Follow `MinimalGraphState` type exactly
- Validate fixtures can encode before adding to tests

### Phase 3: Implement Tests
👤 1-2 hours | 🤖 2-3 hours

Create `app/factory/importexport/encoder.test.ts`:
- Round-trip tests: `encode → decode → deepEqual(original, result)`
- Version migration: test old export formats still decode (use `testExports.json`)
- Malformed input: truncated strings, invalid base85, wrong version markers
- Data integrity: all node/edge properties preserved (IDs, positions, data)
- Compression ratio validation (encoded should be < original JSON length)
- Error messages are helpful (not just "decode failed")

**Success Criteria:**
- All existing exports from `testExports.json` decode successfully
- Round-trip preserves 100% of data (deep equality)
- Graceful error messages for invalid inputs
- Tests run in < 3 seconds

**Agent Notes:**
- Use `describe()` blocks to group related tests
- Test error cases with `expect(() => decode(bad)).toThrow()`
- Compare full state, not just length/shape
- Run individual test: `npm test -- encoder`

---

## 🟡 HIGH VALUE TASK 3: Graph Model Constraint Generation

**Tool:** Vitest  
**Time:** 👤 4-6 hours | 🤖 8-12 hours  
**Dependencies:** Task 1 fixtures can be reused

### What This Covers
The bridge between React Flow UI and solver constraints. Complex transformation logic that's currently hard to test due to tight coupling with React Flow types.

### Phase 1: Refactor for Pure Functions
👤 2 hours | 🤖 4 hours

Extract testable logic from `app/factory/solver/graphModel.ts`:

```typescript
// Create: app/factory/solver/constraintBuilder.ts

// Define minimal types without React Flow dependencies
export type MinimalNode = {
  id: string;
  data: { recipe: RecipeId; multiplier: number; orientation: string };
};

export type MinimalEdge = {
  id: string;
  source: string;
  target: string;
  data: { product: ProductId; isFreed?: boolean };
};

export function buildConstraintsFromGraph(
  nodes: MinimalNode[],
  edges: MinimalEdge[],
  manifolds: ManifoldOptions[]
): Constraint[] {
  // Pure constraint generation logic
  // Move from createGraphModel() - no React Flow types
}

export function groupManifolds(
  edges: MinimalEdge[],
  options: ManifoldOptions[]
): Map<string, MinimalEdge[]> {
  // Pure manifold grouping
  // Extract from createGraphModel()
}

export function generateLoopClosures(
  edges: MinimalEdge[],
  manifoldGroups: Map<string, MinimalEdge[]>
): Constraint[] {
  // Extract loop closure logic
}
```

Update `app/factory/solver/graphModel.ts` to use these functions - becomes thin wrapper over pure functions.

**Agent Notes:**
- Run `npm test -- solver` after each extraction to verify behavior
- Types should NOT import from `@xyflow/react`
- Keep existing `createGraphModel()` signature unchanged
- Test manually in UI after refactor (create factory, solve, verify results)

### Phase 2: Create Test Cases
👤 1 hour | 🤖 2 hours

- Reuse graph fixtures from Task 1 (`app/test/fixtures/graphs.ts`)
- Add manifold-specific scenarios:
  - No manifolds
  - All edges in one manifold
  - Multiple independent manifolds
  - Freed vs non-freed manifolds (test `isFreed` flag)
  - Disconnected manifolds (different graph components)
  - Complex: diamond with manifolds

**Agent Notes:**
- Each fixture needs nodes, edges, AND manifold options
- Manifolds reference edge IDs
- Follow `ManifoldOptions` type from `app/factory/store.ts`

### Phase 3: Implement Tests
👤 1-2 hours | 🤖 2-4 hours

Create `app/factory/solver/constraintBuilder.test.ts`:
- Test constraint count matches expected for each graph
- Verify equality constraints (normal edges) - should have `f: 0`
- Verify inequality constraints (freed manifolds) - should have `f: 1`
- Test loop closure constraints (freed manifolds create loops)
- Validate variable naming (no "inf" prefix - HiGHS parser error)
- Test edge cases: no edges, no manifolds, all freed, none freed
- Snapshot constraint structure for complex graphs

**Success Criteria:**
- Pure functions can be tested without React Flow
- 15+ test cases covering manifold scenarios
- All constraint types validated (equality, inequality, loop)
- Tests run in < 5 seconds

### Phase 4: Integration Test
👤 1 hour | 🤖 2 hours

- Test full `createGraphModel()` with React Flow types
- Ensure refactor doesn't break existing solver tests
- Manual UI test: create factory, add nodes/edges, solve
- Verify solution numbers match pre-refactor

**Agent Notes:**
- Integration test goes in `solver.test.tsx`
- Compare full `GraphModel` output, not just constraint count
- If UI breaks, check type conversions in `graphModel.ts` wrapper

---

## 🟡 HIGH VALUE TASK 4: Store Action Testing (PARTIALLY COMPLETE)

**Tool:** Vitest + fake-indexeddb  
**Time Estimate:** 👤 6-8 hours | 🤖 12-18 hours  
**Time Actual:** ~6 hours (Phase 1-3 complete for GraphStore)
**Status:** 🔄 IN PROGRESS - GraphStore reducers complete, needs ZoneStore and PlannerStore

### What This Covers
Zustand store mutations and IndexedDB persistence. Critical for data integrity. Three stores to cover: `PlannerStore`, `ProductionZoneStore`, `GraphStore`.

### Implementation Summary

**Phase 1: Refactor Store Actions** ✅ COMPLETE (for GraphStore)

Extracted reducers from GraphStore for easier testing:

✅ Created `app/context/reducers/graphReducers.ts` with pure functions:
- `updateNodeData()` - Update node data immutably
- `updateEdgeData()` - Update edge data immutably  
- `cloneNodesEdges()` - Create new arrays for nodes/edges
- `updateScoringMethod()` - Update scoring method
- `updateBaseWeights()` - Update base weights
- `solutionUpdateAction()` - Handle solver solution updates
- `validateManifolds()` - Validate and update manifold options

**Phase 2: Setup Test Infrastructure** ✅ COMPLETE

Infrastructure already set up from Task 6:

✅ `app/test/setup/indexeddb.ts` - fake-indexeddb auto-imported
✅ `app/test/helpers/renderHelpers.tsx` - Includes `createTestFactoryStore()` helper
✅ fake-indexeddb dependency installed and configured

**Phase 3: Implement Reducer Tests** ✅ COMPLETE (for GraphStore)

Created comprehensive test file:

✅ `app/context/reducers/graphReducers.test.ts` - **50+ test cases**:
- **updateNodeData()** - 6 tests (immutability, merging, missing nodes, empty state)
- **updateEdgeData()** - 5 tests (immutability, partial updates, edge cases)
- **cloneNodesEdges()** - 4 tests (shallow cloning, preservation)
- **updateScoringMethod()** - 3 tests (all scoring methods)
- **updateBaseWeights()** - 3 tests (reference equality optimization)
- **Immutability checks** - 3 tests (verifies pure functions)
- **Edge cases** - 4 tests (null data, sequential updates)
- **solutionUpdateAction()** - 10 tests (solver integration, status handling)
- **validateManifolds()** - 12 tests (constraint validation, edge matching)

✅ Test fixtures created:
- `app/test/fixtures/graphStates.ts` - Sample graph states (basicGraphState, emptyGraphState)

**Key Test Coverage:**
- All reducers return new state objects (immutability verified)
- Edge cases handled gracefully (missing IDs, empty states)
- State immutability proven with reference checks (`toBe` vs `not.toBe`)
- Solver integration tested with mocked solver
- Manifold validation thoroughly tested (constraint matching, updating, filtering)

**Phase 4: Implement Store Integration Tests** ⏳ TODO

Remaining work:
- [ ] Test full GraphStore with IndexedDB persistence
- [ ] Test hydration from IndexedDB
- [ ] Extract reducers for ProductionZoneStore (`app/context/reducers/zoneReducers.ts`)
- [ ] Test ProductionZoneStore reducers
- [ ] Extract reducers for PlannerStore (`app/context/reducers/plannerReducers.ts`)
- [ ] Test PlannerStore reducers
- [ ] Test cross-store interactions (cascading deletes)

**Success Criteria (Partial - 60% Complete):**
- ✅ GraphStore actions have reducer tests (100% complete)
- ✅ State mutations are immutable (verified)
- ⏳ IndexedDB persistence integration tests (pending)
- ⏳ ProductionZoneStore and PlannerStore reducers (pending)
- ⏳ Cross-store operations (pending)
- ✅ Tests run fast (current tests < 5 seconds)

**Recommendations for Completion:**
1. Follow the same pattern for ZoneStore and PlannerStore:
   - Extract reducers to `app/context/reducers/zoneReducers.ts` and `plannerReducers.ts`
   - Create test files with similar structure to `graphReducers.test.ts`
   - Use test fixtures from `app/test/fixtures/`
2. Add IndexedDB integration tests:
   - Test store persistence (mutation → wait → check IndexedDB)
   - Test store hydration (create store → reload → verify state)
   - Use `waitForPersistence()` helper (needs implementation)
3. Test cross-store cascades:
   - Delete zone → verify factories removed
   - Delete factory → verify graph removed

---

## ✅ COMPLETED: Task 5 - Game Data Utility Testing

**Tool:** Vitest  
**Time Actual:** ~3-4 hours  
**Status:** ✅ COMPLETE

### What Was Implemented
Recipe lookups, filtering, and relationship traversal utilities in `app/gameData/utils.ts`. These utilities are used throughout the app and provide reliable game data access.

### Implementation Summary
All phases completed:

**Phase 1: Extract Testable Helpers** ✅ COMPLETE

Created `app/gameData/utils.ts` with all planned functions:

```typescript
export function getRecipesByProduct(productId: ProductId): Recipe[] {
  // Find all recipes that produce this product
  // Extract from inline usage in components
}

export function getRecipesByMachine(machineId: MachineId): Recipe[] {
  // Find all recipes that use this machine
}

export function getRecipeDependencies(
  recipeId: RecipeId,
  maxDepth = 10
): RecipeId[] {
  // Walk dependency tree (inputs → recipes that produce them)
  // Prevent infinite loops with maxDepth
}

export function findRecipes(
  query: string,
  filters?: {
    machine?: MachineId;
    product?: ProductId;
    category?: string;
  }
): Recipe[] {
  // Unified search function - name/description matching + filters
}

export function getRecipeInputs(recipeId: RecipeId): Product[] {
  // Get all input products for a recipe
}

export function getRecipeOutputs(recipeId: RecipeId): Product[] {
  // Get all output products (including byproducts)
}
```

All functions successfully implemented:
- ✅ `getRecipesByProduct()` - Find recipes by product (input/output/both)
- ✅ `getRecipesByMachine()` - Find recipes by machine
- ✅ `getRecipeDependencies()` - Recursive dependency traversal with cycle detection
- ✅ `findRecipes()` - Unified search with multiple filters
- ✅ `getRecipeInputs()` - Get input products for a recipe
- ✅ `getRecipeOutputs()` - Get output products including byproducts

**Phase 2: Implement Tests** ✅ COMPLETE

Created `app/gameData/utils.test.ts` with comprehensive coverage:

Implemented test suites:
- ✅ `getRecipesByProduct()` - Tests for input/output/both directions (5 tests)
- ✅ `getRecipesByMachine()` - Tests for machine filtering (4 tests)
- ✅ `getRecipeInputs()` - Tests for input product retrieval (4 tests)
- ✅ `getRecipeOutputs()` - Tests for output products including byproducts (4 tests)
- ✅ `getRecipeDependencies()` - Tests for recursive dependencies with cycle prevention (6 tests)
- ✅ `findRecipes()` - Tests for unified search and filtering (9 tests)
- ✅ Performance tests - Validates search speed < 100ms (3 tests)
- ✅ Edge case tests - Handles null/undefined, duplicates, optional products (3 tests)

**Total: 38 test cases covering all functionality**

**Success Criteria:** ✅ ALL MET
- ✅ All lookup functions tested with real recipe IDs from gameData
- ✅ Edge cases covered (empty results, missing data, circular dependencies)
- ✅ Performance validated (searches < 100ms, filters < 10ms)
- ✅ Tests use real game data, no mocking
- ✅ Case-insensitive search implemented and tested
- ✅ Multiple filter combinations tested

**Key Achievements:**
- Uses real recipe IDs (IronSmeltingT1Coal, WheatMilling, etc.)
- Comprehensive performance testing confirms fast operations
- Handles circular dependencies gracefully with visited set
- All functions return empty arrays for missing data (no crashes)

---

## ✅ COMPLETED: Task 6 - Component Testing Setup

**Tool:** @testing-library/react + Vitest  
**Time Actual:** ~6-8 hours  
**Status:** ✅ COMPLETE

### What Was Implemented
Foundation for testing React components with user interactions. Full infrastructure setup with helper functions and example tests for RecipeNode and RecipeNodeView components.

### Implementation Summary

**Phase 1: Setup Testing Infrastructure** ✅ COMPLETE

Successfully installed and configured all dependencies:
✅ Dependencies installed:
- @testing-library/react
- @testing-library/user-event  
- @testing-library/jest-dom
- fake-indexeddb

✅ Configuration files created:
- `vitest.component.config.ts` - Separate config for component tests with jsdom
- `app/test/setup/componentTests.ts` - React Testing Library + jest-dom matchers
- `app/test/setup/indexeddb.ts` - IndexedDB polyfill for Node environment

✅ Test helper functions implemented in `app/test/helpers/renderHelpers.tsx`:
Implemented helper functions:
- ✅ `createTestFactoryStore()` - Creates isolated test stores with IndexedDB
- ✅ `renderWithFactory()` - Renders components with FactoryContext provider
- ✅ `getFactoryWrapper()` - Wrapper component for FactoryContext (used in Cosmos fixtures)
- ✅ `getRouterWrapper()` - Wrapper for MemoryRouter (routing tests)
- ✅ `getZoneWrapper()` - Wrapper for ProductionZoneProvider (zone context tests)

**Key Features:**
- Supports optional ReactFlowProvider wrapping
- Allows custom store injection or auto-creates test stores
- Handles both isolated unit tests and integrated context tests
- Properly configures IndexedDB for persistence testing

✅ Vitest configuration updated:
- Separate configs: `vite.config.ts` (unit tests, Node env) and `vitest.component.config.ts` (component tests, jsdom)
- Component tests use `*.component.test.tsx` naming convention
- Setup files configured for IndexedDB and React Testing Library matchers

**Phase 2: Refactor Components for Testability** ✅ COMPLETE

Extracted presentation logic from components:
✅ Created `app/factory/graph/recipeNodeLogic.ts` with pure functions:
- `calculateIOCounts()` - Calculate input/output product counts
- `findHandlePositions()` - Determine handle layout based on recipe
- `getRecipeDisplayInfo()` - Extract display data from recipe
- All functions are pure (no React dependencies, easy to test)

✅ Tests created: `app/factory/graph/recipeNodeLogic.test.ts` (7 unit tests)
- Tests handle position calculations for various recipes
- Tests I/O count calculations
- Fast execution (pure functions, no DOM rendering)

**Phase 3: Implement Sample Tests** ✅ COMPLETE

Created comprehensive component test suites:

✅ `app/factory/graph/RecipeNode.component.test.tsx` - **17 test cases**:
- Rendering tests (title bar, machine name, ports)
- Solution data display (building counts, multipliers)
- Orientation tests (ltr/rtl)
- Handle rendering (inputs/outputs)
- React Flow integration tests
- Custom node props validation

✅ `app/factory/graph/RecipeNodeView.component.test.tsx` - **Component view tests**:
- Render testing with different recipes
- Port display validation
- Machine icon rendering
- Data flow verification

**Success Criteria:** ✅ ALL MET
- ✅ Test infrastructure in place and working (vitest.component.config.ts)
- ✅ Multiple components have coverage (RecipeNode, RecipeNodeView)
- ✅ Patterns documented and reusable (renderHelpers provides templates)
- ✅ Tests run fast (< 5 seconds for all component tests)
- ✅ jsdom environment configured correctly
- ✅ IndexedDB mocking works with fake-indexeddb
- ✅ React Flow components properly mocked

**Key Achievements:**
- Established clear separation: `.test.ts` for unit tests (Node), `.component.test.tsx` for component tests (jsdom)
- Full helper library enables easy test creation
- Component tests validate both rendering and React Flow integration
- Pure logic extraction enables fast unit testing
- Pattern documented in `COMPONENT_TESTING.md` for future reference

---

## 🟢 FOUNDATIONAL TASK 7: Custom Hydration Testing

**Tool:** Vitest  
**Time:** 👤 2 hours | 🤖 3-4 hours  
**Dependencies:** None

### What This Covers
Map/Set serialization for IndexedDB (`app/hydration.ts`). Small but critical for data integrity - corrupt serialization = data loss.

### Phase 1: Review Current Implementation
👤 30 min | 🤖 1 hour

- Examine `app/hydration.ts` - understand replacer/reviver pattern
- Identify all types that need custom serialization:
  - Map<string, any>
  - Set<any>
  - Nested structures (Map<string, Set<number>>)
- Check usage in stores (`PlannerStore`, `ProductionZoneStore`, `GraphStore`)
- Verify stores use `hydration.replacer` and `hydration.reviver` with IndexedDB

**Agent Notes:**
- Maps/Sets don't serialize to JSON by default (become empty objects)
- Hydration marks them with `__type: 'Map'` or `__type: 'Set'`
- Check `app/context/PlannerProvider.tsx` for usage example

### Phase 2: Implement Tests
👤 1.5 hours | 🤖 2-3 hours

Create `app/hydration.test.ts`:

**Round-trip tests:**
```typescript
describe('Map serialization', () => {
  it('handles string keys', () => {
    const original = new Map([['key1', 'value1'], ['key2', 'value2']]);
    const json = JSON.stringify(original, hydration.replacer);
    const result = JSON.parse(json, hydration.reviver);
    expect(result).toEqual(original);
  });

  it('handles number keys', () => {
    // Maps can have non-string keys
  });

  it('handles object values', () => {
    // Complex values in Map
  });
});

describe('Set serialization', () => {
  it('handles primitives', () => {
    const original = new Set([1, 2, 3, 'a', 'b']);
    // Round-trip test
  });

  it('handles objects', () => {
    // Sets with object values
  });
});

describe('Nested structures', () => {
  it('handles Map<string, Set<number>>', () => {
    const original = new Map([
      ['key1', new Set([1, 2, 3])],
      ['key2', new Set([4, 5])],
    ]);
    // Round-trip test
  });

  it('handles Set<Map<string, any>>', () => {
    // Deeply nested structures
  });
});
```

**Edge cases:**
- Empty Map/Set
- Very large Map/Set (1000+ entries)
- Special values (undefined, null, NaN)
- Circular references (should handle gracefully or error clearly)

**Integration test:**
```typescript
describe('Store persistence', () => {
  it('persists Map/Set in store state', async () => {
    // Create store with Map/Set
    // Persist to IndexedDB (using fake-indexeddb)
    // Load from IndexedDB
    // Verify Map/Set restored correctly
  });
});
```

**Success Criteria:**
- All Map/Set types serialize correctly
- Nested structures work (Map<Set>, Set<Map>)
- Edge cases handled (empty, large, special values)
- Integration with IndexedDB verified
- Tests run in < 2 seconds

**Agent Notes:**
- Use `toEqual()` for deep equality (not `toBe()`)
- Test with real store data structures if possible
- If integration test fails, check fake-indexeddb setup
- Round-trip = serialize → deserialize → compare to original

---

## 🟢 FOUNDATIONAL TASK 8: E2E Smoke Tests

**Tool:** Playwright  
**Time:** 👤 4-6 hours | 🤖 8-12 hours  
**Time Actual:** ~2 hours (Phase 1 complete)  
**Status:** 🔄 IN PROGRESS - Setup complete, basic tests implemented  
**Dependencies:** Best done after Task 6 (component refactoring helps stability)

### What This Covers
Critical user paths only. Minimal E2E coverage for integration confidence. Heavy setup but high value for catching breaking changes.

### Phase 1: Setup Playwright ✅ COMPLETE

Installed and configured Playwright with production build serving:

✅ Installed `@playwright/test` dependency
✅ Created `playwright.config.ts` with:
  - Production build serving via `npm run preview`
  - Chromium-only for fast CI runs
  - Screenshot on failure
  - Trace on retry
  - CI-aware configuration (retries, reporter)

✅ Added npm scripts:
  - `npm run preview` - Serve production build on port 4173
  - `npm run test:e2e` - Run Playwright tests

✅ Updated `.gitignore` to exclude Playwright artifacts

✅ Created initial smoke test (`e2e/app.spec.ts`):
  - Tests zone selector visibility
  - Tests factory goals section visibility
  - Tests sidebar factory tabs
  - Tests sidebar expansion

**Configuration Notes:**
- Uses `vite preview` instead of dev server for production-like testing
- Single chromium project for simplicity (add more browsers as needed)
- `fullyParallel: true` enabled since tests don't share IndexedDB state

### Phase 2: Implement Critical Path Tests ⏳ TODO
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 min for slow starts
  },
});
```

Current directory structure (add new specs here):
```
e2e/
  app.spec.ts
  factory-import.spec.ts
  # add more *.spec.ts files as coverage expands
```

**Agent Notes:**
- Run `npm run test:e2e -- --headed` to see browser
- Use `npx playwright codegen http://localhost:4173` to generate selectors
- Tests run against production preview (`npm run preview`, port 4173)
- Single worker on CI prevents IndexedDB conflicts between tests

### Phase 2: Implement Critical Path Tests
👤 3-4 hours | 🤖 5-7 hours

**Test 1: Create and Solve Factory** (`e2e/app.spec.ts`)
```typescript
import { test, expect } from '@playwright/test';

test('create factory and solve', async ({ page }) => {
  // Navigate to app
  await page.goto('/');
  
  // Create new zone
  await page.click('text=New Zone');
  await page.fill('input[name=zoneName]', 'Test Zone');
  await page.click('text=Create');
  
  // Create factory
  await page.click('text=New Factory');
  await page.fill('input[name=factoryName]', 'Test Factory');
  await page.click('text=Create');
  
  // Add recipe node (use sidebar search)
  await page.fill('input[placeholder*=Search]', 'iron smelting');
  await page.click('text=Iron Smelting'); // Drag to canvas
  
  // Solve factory
  await page.click('text=Solve');
  await expect(page.locator('text=Solution found')).toBeVisible();
  
  // Export factory
  await page.click('text=Export');
  const downloadPromise = page.waitForEvent('download');
  await page.click('text=Download');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.txt$/);
});
```

**Test 2: Import Factory** (`e2e/factory-import.spec.ts`)
```typescript
test('import factory from export', async ({ page }) => {
  await page.goto('/');
  
  // Use test export from testExports.json
  const testExport = 'base85 encoded string from fixture';
  
  await page.click('text=Import');
  await page.fill('textarea', testExport);
  await page.click('text=Import Factory');
  
  // Verify nodes rendered
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  
  // Verify solution loaded
  await expect(page.locator('text=/buildings?/')).toBeVisible();
});
```

**Test 3: Navigation** (`e2e/navigation.spec.ts`)
```typescript
test('navigate between zones and factories', async ({ page }) => {
  await page.goto('/');
  
  // Create 2 zones with factories
  // ... setup code ...
  
  // Navigate to zone 1
  await page.click('text=Test Zone 1');
  await expect(page).toHaveURL(/\/zones\/[^/]+$/);
  
  // Navigate to factory
  await page.click('text=Test Factory 1');
  await expect(page).toHaveURL(/\/zones\/[^/]+\/[^/]+$/);
  
  // Navigate back to zones list
  await page.click('text=All Zones');
  await expect(page).toHaveURL('/');
  
  // Verify state persisted (check IndexedDB)
  const zonesCount = await page.evaluate(() => {
    return new Promise((resolve) => {
      const request = indexedDB.open('planner-db');
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('zones', 'readonly');
        const store = tx.objectStore('zones');
        const countRequest = store.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
      };
    });
  });
  expect(zonesCount).toBe(2);
});
```

**Agent Notes:**
- Use `test.describe.serial()` for tests that depend on each other
- Clear IndexedDB between independent tests: `await page.evaluate(() => indexedDB.deleteDatabase('planner-db'))`
- Use `page.pause()` to debug interactively
- Selectors: prefer `text=` over CSS (more stable)
- Wait for navigation: `await expect(page).toHaveURL(...)`
- Run single test: `npm run test:e2e -- app.spec.ts`

### Phase 3: CI Integration
👤 1 hour | 🤖 2 hours

**If using GitHub Actions:**
```yaml
# Create: .github/workflows/e2e.yml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

**Local CI simulation:**
```bash
# Run in headless mode (like CI)
npm run build
npm run test:e2e

# View report
npx playwright show-report
```

**Success Criteria:**
- 3 smoke tests pass (create, import, navigate)
- Tests run in < 2 minutes total
- Failures produce actionable screenshots
- CI integration working (if applicable)

**Agent Notes:**
- E2E tests are slowest - keep minimal
- Use `test.slow()` for tests that need more time
- Screenshots saved to `test-results/` on failure
- Trace viewer: `npx playwright show-trace trace.zip`

---

## Task Priority Matrix (Updated)

| Task | Priority | Agent Time | Dev Time | Dependencies | ROI | Status |
|------|----------|------------|----------|--------------|-----|--------|
| 1. Solver Tests | 🔴 | 4-8h | 2-4h | None | ⭐⭐⭐⭐⭐ | ⏳ TODO |
| 2. Import/Export | 🔴 | 5-8h | 3-4h | None | ⭐⭐⭐⭐⭐ | ⏳ TODO |
| 3. Graph Model | 🟡 | 8-12h | 4-6h | Task 1 | ⭐⭐⭐⭐ | ⏳ TODO |
| 5. Game Data | 🟡 | 3-5h | 2-3h | None | ⭐⭐⭐⭐ | ✅ **DONE** |
| 7. Hydration | 🟢 | 3-4h | 2h | None | ⭐⭐⭐ | ⏳ TODO |
| 6. Components | 🟢 | 8-12h | 4-6h | None | ⭐⭐⭐ | ✅ **DONE** |
| 4. Store Actions | 🟡 | 12-18h | 6-8h | None | ⭐⭐⭐ | 🔄 60% DONE |
| 8. E2E | 🟢 | 8-12h | 4-6h | Task 6 | ⭐⭐ | 🔄 30% DONE |

**Progress Summary:**
- ✅ 2 tasks fully complete (Tasks 5, 6)
- 🔄 2 tasks partially complete (Task 4 - 60%, Task 8 - 30%)
- ⏳ 4 tasks remaining (Tasks 1, 2, 3, 7)
- **Total Progress: ~30% complete** (3.1 of 8 tasks)

## Recommended Sequence (Updated for Remaining Work)

### For AI Agents (Conservative Path)

**✅ COMPLETED (Weeks 1-3):** Tasks 5, 6, partial Task 4, partial Task 8 (~17-22h invested)
- Task 5: Game Data Utils - COMPLETE
- Task 6: Component Testing Setup - COMPLETE  
- Task 8: E2E Setup - COMPLETE (basic smoke tests working)
- Task 4: GraphStore reducers - COMPLETE (60% of task)

**Week 4-5 (NEXT):** Tasks 1, 2 **(10-16h total)** - PRIORITY
- Critical path coverage
- Core safety net for solver and data persistence
- Should be done BEFORE any major refactoring

**Week 6:** Task 7 **(3-4h)** - Quick Win
- Small, isolated hydration testing
- Completes data persistence testing suite
- Can be done in parallel with other tasks

**Week 7:** Complete Task 4 **(6-8h remaining)**
- ZoneStore and PlannerStore reducers
- IndexedDB integration tests
- Cross-store cascade testing

**Week 8-9:** Task 3 **(8-12h)**
- Higher complexity refactor
- Graph model constraint testing
- Benefits from Tasks 1, 2 being complete

**Week 10:** Task 8 **(8-12h)**
- E2E smoke tests
- Benefits from all prior component work
- Final integration confidence layer

**Remaining Agent Time:** ~35-52 hours over 7 weeks (~5-7h/week)

### For Experienced Developer (Aggressive Path)

**✅ COMPLETED:** Tasks 5, 6, partial Task 4 (~10-12h invested)

**Week 4 (NEXT):** Tasks 1, 2 **(5-8h)** - PRIORITY  
**Week 5:** Task 7 + Complete Task 4 **(4-6h)**  
**Week 6:** Task 3 **(4-6h)**  
**Week 7:** Task 8 **(4-6h)**

**Remaining Dev Time:** ~17-26 hours over 4 weeks (~4-6h/week)

---

## Agent-Specific Guidelines

### When Starting a Task

1. **Read the full task description** - Don't skip phases
2. **Check dependencies** - Ensure prerequisite tasks complete
3. **Run existing tests first** - `npm test` to establish baseline
4. **Review related files** - Understand current implementation
5. **Ask for clarification** - If task unclear, ask before coding

### During Implementation

1. **Make small changes** - Commit after each phase
2. **Test frequently** - After every logical change
3. **Verify in UI** - For refactoring, manually test app still works
4. **Document assumptions** - Add comments explaining non-obvious logic
5. **Run full test suite** - Before marking task complete

### Common Pitfalls

1. **Changing too much at once** - Refactor incrementally
2. **Skipping validation** - Always test refactor before adding tests
3. **Mock-happy testing** - Use real data (gameData.ts) when possible
4. **Flaky E2E tests** - Add explicit waits, don't rely on implicit timing
5. **Breaking existing functionality** - Run full app manually after refactoring

### When Stuck

1. **Run test in isolation** - `npm test -- <filename>`
2. **Use test debugging** - Add `console.log()`, use `test.only()`
3. **Check type errors** - `npm run typecheck`
4. **Review similar tests** - Look at existing test patterns
5. **Ask for help** - Provide specific error messages and context

---

## Success Metrics

After completing all tasks:

✅ **Core solver has 90%+ coverage** - Edge cases tested  
✅ **Zero data loss in import/export** - Round-trip verified  
✅ **Store actions are predictable** - All mutations tested  
✅ **Components have testable architecture** - Logic extracted  
✅ **E2E tests catch integration issues** - Critical paths covered  
✅ **Test suite runs in < 30 seconds** (excluding E2E < 2min)  
✅ **New features can be TDD'd** - Infrastructure in place  
✅ **Refactoring is safer** - Tests catch regressions  

**Test Metrics:**
- Unit tests: < 5 seconds total
- Component tests: < 10 seconds total  
- Integration tests: < 15 seconds total
- E2E tests: < 2 minutes total
- Total coverage: 60-70% (focusing on high-risk areas)

---

## Maintenance

### Adding New Tests

After initial implementation, maintain test quality:

1. **New solver features** → Add to Task 1 tests
2. **New store actions** → Add to Task 4 reducer tests
3. **New components** → Follow Task 6 patterns
4. **New import formats** → Add to Task 2 fixtures
5. **New critical paths** → Consider Task 8 E2E (sparingly)

### Running Tests

```bash
# All tests (quick)
npm test

# Watch mode (during development)
npm test -- --watch

# Coverage report
npm test -- --coverage

# Specific file
npm test -- solver

# E2E tests
npm run test:e2e

# E2E with UI
npm run test:e2e -- --headed

# Update snapshots (after intentional changes)
npm test -- -u
```

### CI Integration

Recommended GitHub Actions workflow:
```yaml
name: Tests
on: [push, pull_request]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test -- --coverage
  
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```
