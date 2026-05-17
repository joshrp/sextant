# React Cosmos - Component Development Guide

React Cosmos is integrated into the project for isolated component development and visual testing. Use it to develop, test, and verify UI components in isolation without running the full application.

## Running Cosmos

Start the Cosmos development server:
```bash
npm run cosmos
```

This launches an interactive component explorer at `http://localhost:5000` (default port) where you can:
- View and interact with components in isolation
- Test different component states and props
- Verify visual changes without navigating through the full app
- Develop new components with hot reloading

## Creating Fixtures

Fixtures are files that define how components should be rendered in Cosmos. Create fixture files with the `.fixture.tsx` extension.

**Location**: Place fixtures next to the components they test (e.g., `app/components/MyComponent.fixture.tsx`)

**Fixture Philosophy**: Be conservative about states to include. Prop values can be changed in the UI easily, so include only key states that change large portions of the component, not details and small variations.

### Basic Pattern

```tsx
import MyComponent from './MyComponent';

export default {
  'Default State': () => <MyComponent />,
  'With Props': () => <MyComponent prop1="value" prop2={123} />,
  'Error State': () => <MyComponent error="Something went wrong" />
};
```

### Prefer rendering the pure view component

**When a node type uses an existing view component** (e.g. `RecipeNodeView`, `ThermalStorageNodeView`, `BalancerNodeView`), write the fixture against that pure view directly — wrapped only in `ReactFlowProvider`. This avoids dragging in `FactoryContext`, `ProductionZoneProvider`, the Zustand store, and IndexedDB, all of which the full `RecipeNode` wrapper depends on and which can break or render blank in Cosmos.

```tsx
import { ReactFlowProvider } from '@xyflow/react';
import { useState } from 'react';
import { useFixtureInput } from 'react-cosmos/client';
import { loadData, type ProductId, type RecipeId } from '../loadJsonData';
import RecipeNodeView from './RecipeNodeView';
import { DEFAULT_ZONE_MODIFIERS } from '../../../context/zoneModifiers';

const { recipes } = loadData();

const createFixture = (recipeId: string, defaultRunCount: number) => {
  const [flipped, setFlipped] = useState(false);
  const [runCount] = useFixtureInput('Run Count', defaultRunCount);
  const recipe = recipes.get(recipeId as RecipeId);
  if (!recipe) return <div>Recipe not found</div>;

  const inputEdges = new Map<ProductId, boolean>();
  const outputEdges = new Map<ProductId, boolean>();
  for (const { product } of recipe.inputs) inputEdges.set(product.id, false);
  for (const { product } of recipe.outputs) outputEdges.set(product.id, false);

  return (
    <ReactFlowProvider>
      <RecipeNodeView
        recipe={recipe}
        inputEdges={inputEdges}
        outputEdges={outputEdges}
        solution={{ solved: true, runCount }}
        ltr={!flipped}
        zoomLevel={0}
        onFlip={() => setFlipped(!flipped)}
        onRemove={() => {}}
        modifiers={DEFAULT_ZONE_MODIFIERS}
      />
    </ReactFlowProvider>
  );
};

export default {
  'Variant A': () => createFixture('SomeRecipeId', 1),
  'Variant B': () => createFixture('SomeOtherRecipeId', 3),
};
```

This is the pattern used by `RecipeNodeView.fixture.tsx`, `ThermalStorageNodeView.fixture.tsx`, and `SpaceStationNode.fixture.tsx`. Use it whenever the new node type's behavior lives in `RecipeNodeView` or one of the other view components rather than in `RecipeNode` itself.

### Full-wrapper pattern (only when you need store-level behavior)

If your fixture genuinely needs the `RecipeNode` wrapper — e.g. you're testing edge connections, store-driven state, or the drag/drop alignment effect — use the full wrapper with `getFactoryWrapper`. Expect Cosmos to need a hard refresh after edits if hot reload glitches.

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
};
```

## Verifying UI Changes

**When making UI component changes:**
1. Run `npm run cosmos` to start the development server
2. Navigate to the fixture for the component you're modifying
3. Verify the visual changes work correctly across all fixture states
4. Test interactions (clicks, hovers, etc.) in the Cosmos UI
5. Check multiple viewport sizes if the component is responsive
6. Take screenshots of the component states to document changes

**Benefits:**
- No need to navigate through the full app to reach the component
- Test edge cases and different prop combinations easily
- Fast feedback loop with hot reloading
- Catch visual regressions early in development

## Cosmos Configuration

Configuration is in `cosmos.config.json`:
- Uses the Vite plugin for fast builds
- Shares config with component tests (`vitest.component.config.ts`)
- Watches `./app` directory for changes
- Includes global styles from `app/app.css`
- Static assets served from `public/` directory

## Existing Fixtures

Current fixture files in the repository:
- `app/components/ProductSelector.fixture.tsx` - Basic component fixture example
- `app/factory/graph/nodes/RecipeNodeView.fixture.tsx` - **Recommended pattern**: pure view + ReactFlowProvider
- `app/factory/graph/nodes/ThermalStorageNodeView.fixture.tsx` - Same pattern, with options state
- `app/factory/graph/nodes/SpaceStationNode.fixture.tsx` - Same pattern across two node-data types
- `app/factory/graph/nodes/RecipeNode.fixture.tsx` - Full-wrapper pattern with store and React Flow (use sparingly — see above)
- `app/components/FactoryOverlayBar.fixture.tsx` - Example with multiple states
- `app/components/SidebarPopover.fixture.tsx` - Popover component variants

Reference these files when creating new fixtures.
