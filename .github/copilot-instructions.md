# COI Calculator - AI Agent Instructions

## Project Overview
Production planning calculator for Captain of Industry game. React-based SPA using React Router v7 with linear programming solver (HiGHS.js) to optimize factory layouts and resource flows.

## Architecture

### State Management Hierarchy
Three-level Zustand store hierarchy persisted to IndexedDB:
1. **PlannerStore** (`app/context/PlannerProvider.tsx`) - Global zones management
2. **ProductionZoneStore** (`app/context/ZoneProvider.tsx`) - Zone-level factories and weights
3. **GraphStore** (`app/factory/store.ts`) - Individual factory graph state (nodes/edges/solution)

Stores are cached and reused across navigations. Use `useFactory()`, `useProductionZone()`, `usePlanner()` context hooks.

### Custom Hydration for IndexedDB
Map and Set types require custom serialization (`app/hydration.ts`). Always use `hydration.replacer` and `hydration.reviver` when storing to IndexedDB or localStorage.

### Game Data Pipeline
Static game data (`app/gameData.ts`, 32K+ lines) sourced from Captain of Industry mod exports:
- Parsed via `data/reformat.ts` from `data/raw/` JSON files
- Products, recipes, machines with complex relationships (inputs/outputs/dependencies)
- Run `npm run formatData` to regenerate `gameData.ts` from raw sources
- Icons extracted from Unity asset bundles (see `data/README.md`)

## Critical Workflows

### Linear Programming Solver
Core constraint-based optimization in `app/factory/solver/solver.ts`:
- Converts React Flow graph (nodes = recipes, edges = product flows) into Linear Programming Problem
- Uses HiGHS WASM solver with 2-second timeout (`highsOptions`)
- Three constraint types: equality (=0), loose (>=0), tight loop closures
- Scoring methods: `infra` (infrastructure), `inputs`, `footprint`, `outputs`
- **Never create variables starting with "inf"** - HiGHS parser error

### Graph Model Pattern
1. User builds factory graph with `@xyflow/react` (`app/factory/graph/graph.tsx`)
2. `createGraphModel()` builds constraint system from nodes/edges
3. `solve()` generates LPP, runs solver, returns `Solution` with node counts
4. Solution drives UI updates (manifolds, summaries, node decorations)

### Testing
- Vitest with snapshot testing for solver LPP generation
- Run unit tests: `npm test`
- Run component tests: `npm run test:component`
- Run linting: `npm run lint`
- Type checking: `npm run typecheck`
- Coverage reports in `coverage/` directory
- Critical: `app/factory/solver/solver.test.tsx` validates constraint generation
- Component tests in `app/test/` using React Testing Library and run with a custom Vitest config on `npm run test:component`
- Visual component tests with React Cosmos (see below)
  - If a file you change has a fixture associated with it, test your change in cosmos as well to verify visual correctness
  - Also you may need to update the fixture to match any prop or behavior changes you made

### Import/Export System
Factory states compressed via base85 encoding (`app/factory/importexport/importexport.ts`):
- Custom minification of node/edge/goal data structures
- Version-aware deserialization with type mappings
- Test fixtures in `testFactories.json` and `testExports.json`

## Key Patterns

### Type System
- `ProductId`, `RecipeId`, `MachineId` are branded string types (not real keyof due to size)
- `CustomNodeType` and `CustomEdgeType` extend React Flow types with game-specific data
- `RecipeNodeData` contains recipe reference, orientation (ltr), multiplier

### Routing Convention
Nested routes use React Router v7 layout pattern:
- `/zones/:zone/:factory?` - Main factory view
- `/zones/:zone/:factory/settings/:tab?` - Modal overlay settings
- Use `useStableParam()` helper (in `app/routes.ts`) to memoize route params

### Icon Helpers
Centralized in `app/uiUtils.ts`:
- `productIcon(iconName)` → `/assets/products/{icon}`
- `machineIcon(machine)` → `/assets/buildings/{machine.icon}`
- `uiIcon(name)` → `/assets/ui/{name}.png`

### Manifold Constraints
User-togglable edge groups that can be "freed" (unconstrained) in solver:
- Stored as `ManifoldOptions[]` in GraphStore
- UI shows manifold selectors on edges (`app/factory/graph/edges/ButtonEdge.tsx`)
- Affects which constraints are included in LPP generation

## Development Commands

```bash
npm run dev          # Vite dev server on :5173
npm run build        # Production build to build/
npm start            # Serve production build
npm test             # Run Vitest test suite
npm run test:component   # Run component tests with Vitest
npm run test:all     # Run all tests (unit + component)
npm run formatData   # Regenerate gameData.ts from raw sources
npm run typecheck    # React Router typegen + TypeScript check
npm run lint         # ESLint
npm run cosmos       # Run React Cosmos dev server for component development
npm run cosmos-export # Export static Cosmos build
```

## React Cosmos for Component Development

React Cosmos is integrated into the project for isolated component development and visual testing. Use it to develop, test, and verify UI components in isolation without running the full application.

### Running Cosmos

Start the Cosmos development server:
```bash
npm run cosmos
```

This launches an interactive component explorer at `http://localhost:5000` (default port) where you can:
- View and interact with components in isolation
- Test different component states and props
- Verify visual changes without navigating through the full app
- Develop new components with hot reloading

### Creating Fixtures

Fixtures are files that define how components should be rendered in Cosmos. Create fixture files with the `.fixture.tsx` extension:

**Location**: Place fixtures next to the components they test (e.g., `app/components/MyComponent.fixture.tsx`)

When making fixtures, be conservative about states to include. Prop values can be changed in UI easily so include only key states that change large portions of the component, not details and small variations.

**Basic Pattern**:
```tsx
import MyComponent from './MyComponent';

export default {
  'Default State': () => <MyComponent />,
  'With Props': () => <MyComponent prop1="value" prop2={123} />,
  'Error State': () => <MyComponent error="Something went wrong" />
};
```

**Complex Example** (with store/context setup):
```tsx
import RecipeNode from './factory/graph/RecipeNode';
import type { RecipeNodeData } from './factory/graph/recipeNodeLogic';
import { createTestFactoryStore, getFactoryWrapper } from './test/helpers/renderHelpers';

const factoryId = 'test-factory';
const testStore = createTestFactoryStore(factoryId, 'Test Factory');

export default {
  'Power Generator': () => getFactoryWrapper(
    <RecipeNode data={{ recipeId: 'PowerGeneratorT2', ltr: true }} />,
    { withReactFlow: true, store: testStore, factoryId }
  ),
  'Another Variant': () => getFactoryWrapper(
    <RecipeNode data={{ recipeId: 'FBR', ltr: false }} />,
    { withReactFlow: true, store: testStore, factoryId }
  )
};
```

### Verifying UI Changes

**When making UI component changes**:
1. Run `npm run cosmos` to start the development server
2. Navigate to the fixture for the component you're modifying
3. Verify the visual changes work correctly across all fixture states
4. Test interactions (clicks, hovers, etc.) in the Cosmos UI
5. Check multiple viewport sizes if the component is responsive
6. Take screenshots of the component states to document changes

**Benefits**:
- No need to navigate through the full app to reach the component
- Test edge cases and different prop combinations easily
- Fast feedback loop with hot reloading
- Catch visual regressions early in development

### Cosmos Configuration

Configuration is in `cosmos.config.json`:
- Uses the Vite plugin for fast builds
- Shares config with component tests (`vitest.component.config.ts`)
- Watches `./app` directory for changes
- Includes global styles from `app/app.css`
- Static assets served from `public/` directory

### Existing Fixtures

Current fixture files in the repository:
- `app/components/ProductSelector.fixture.tsx` - Basic component fixture example
- `app/RecipeNode.fixture.tsx` - Complex fixture with store and React Flow integration

Reference these files when creating new fixtures.

## Important Gotchas

1. **Node IDs must be stable** - React Flow depends on consistent node IDs for state
3. **IndexedDB is async** - All store persistence operations return promises
4. **Client-side only — NO SSR** - This project is a client-side-only app. Do not enable or add server-side rendering (SSR).

- Rationale: the app relies on browser-only APIs, IndexedDB persistence, and runtime-only assets (e.g. HiGHS WASM via CDN) that expect a browser environment.
- When editing or adding code, always guard browser APIs with `if (typeof window !== 'undefined')` and avoid adding server entry points or server-only React Router routes.
5. **HiGHS loads differently** - Uses CDN locator in browser, direct in Node and testing (see `solver.ts:11-14`)
6. **Recycling is global** - COI game shares recycling across all waste sorters (see `app/Help.md`)

## File Organization Heuristics

- `app/context/` - Zustand stores and React context providers
- `app/factory/` - Factory graph, solver, and import/export logic
- `app/factory/graph/` - React Flow components (nodes, edges, sidebar)
- `app/components/` - Shared UI components
- `data/` - Game data processing and raw source files
- `public/assets/` - Static game icons and images

## Testing Roadmap

- Read `./doc/TESTING_ROADMAP.md` for detailed testing strategy and task list
