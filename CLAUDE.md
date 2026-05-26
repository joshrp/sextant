# COI Calculator

React SPA for Captain of Industry production planning using React Router v7 + HiGHS.js linear programming solver.

## Quick Reference

### State Management
- Three-level Zustand hierarchy (IndexedDB-persisted): PlannerStore → ProductionZoneStore → GraphStore
- Access via: `useFactory()`, `useProductionZone()`, `usePlanner()` hooks
- **Always use `hydration.replacer`/`hydration.reviver`** for IndexedDB/localStorage (Map/Set serialization)

### Game Data
- Static data in `app/gameData.ts` (32K+ lines)
- Regenerate: `npm run formatData` (from `data/raw/` → via `data/reformat.ts`)
- Icons: `/assets/products/`, `/assets/buildings/`, `/assets/ui/`

## Critical Rules

### Solver (app/factory/solver/solver.ts)
- **NEVER create variables starting with "inf"** — HiGHS parser error
- Graph → LPP → HiGHS solver (2s timeout) → Solution
- Constraint types: equality (=0), loose (>=0), tight loop
- Scoring: `infra`, `inputs`, `footprint`, `outputs`

### Testing
- Unit: `npm test` | Component: `npm run test:component` | All: `npm run test:all`
- **When changing components with fixtures**: test in Cosmos (`npm run cosmos`)
- **Update fixtures** if props/behavior change
- Solver snapshots in `app/factory/solver/solver.test.tsx`

### Import/Export
- Base85 encoding in `app/factory/importexport/importexport.ts`
- Test fixtures: `testFactories.json`, `testExports.json`

### Icons (app/uiUtils.ts)
- `productIcon(iconName)` → `/assets/products/{icon}`
- `machineIcon(machine)` → `/assets/buildings/{machine.icon}`
- `uiIcon(name)` → `/assets/ui/{name}.png`

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
npm run cosmos       # Run React Cosmos dev server (port 5000)
npm run cosmos-export # Export static Cosmos build
```

## React Cosmos

- Isolated component development: `npm run cosmos` (port 5000)
- **When changing components with fixtures**: verify in Cosmos before marking complete
- **Fixture location**: next to component (`.fixture.tsx`)
- **Be conservative**: include only key states, not small variations
- **Basic fixture**: `export default { 'State': () => <Component /> }`
- **Complex fixture**: use `createTestFactoryStore()` and `getFactoryWrapper()` (see `app/RecipeNode.fixture.tsx`)
- Config: `cosmos.config.json` (Vite, watches `./app`, includes `app/app.css`)

## Important Gotchas

1. **Node IDs must be stable** — React Flow depends on consistent node IDs for state
2. **Never create variables starting with "inf"** — HiGHS parser error
3. **IndexedDB is async** — All store persistence operations return promises
4. **When changing components with fixtures** — Verify in Cosmos (`npm run cosmos`)

## Additional Documentation

@.github/ARCHITECTURE.md

@.github/COSMOS_GUIDE.md
