# Component Testing (Updated)

## Overview

Component testing infrastructure is **fully implemented** with comprehensive helpers and example tests. This document describes the current setup and patterns.

## Setup

Component testing uses a separate test suite with jsdom for comprehensive React component testing:
- **Vitest** with jsdom environment (component tests only)
- **@testing-library/react** for rendering
- **@testing-library/user-event** for interactions
- **fake-indexeddb** for IndexedDB mocking

Configuration in `vitest.component.config.ts` (separate from unit tests):
```typescript
plugins: [tailwindcss(), tsconfigPaths()]  // No reactRouter() needed
test: {
  include: ['**/*.component.test.{ts,tsx}'],
  environment: 'jsdom',
  setupFiles: ['./app/test/setup/indexeddb.ts', './app/test/setup/componentTests.ts'],
}
```

**Key Points:**
- Unit tests (`.test.ts`) run in Node environment via `vite.config.ts` (faster)
- Component tests (`.component.test.tsx`) run in jsdom via `vitest.component.config.ts`
- Separate configs prevent conflicts and optimize performance

## Test Helpers (Comprehensive Suite)

Located in `app/test/helpers/renderHelpers.tsx` - provides complete testing utilities:

### Factory Context Testing

```typescript
// Basic usage - auto-creates test store
const { container, store } = renderWithFactory(<MyComponent />);

// With custom store (for pre-configured state)
const store = createTestFactoryStore('my-factory', 'Test Factory');
const { container } = renderWithFactory(<MyComponent />, { store });

// With React Flow provider (for components using React Flow hooks)
renderWithFactory(<MyComponent />, { 
  withReactFlow: true,
  factoryId: 'test-id',
  factoryName: 'Test Name'
});
```

**Available Helpers:**
- `createTestFactoryStore(id, name)` - Creates isolated store with IndexedDB
- `renderWithFactory(ui, options)` - Renders with FactoryContext provider
- `getFactoryWrapper(children, options)` - Wrapper component (for fixtures/manual wrapping)
- `getRouterWrapper(children, options)` - Wrapper for React Router testing
- `getZoneWrapper(children, options)` - Wrapper for ProductionZoneProvider

### IndexedDB Testing

IndexedDB is automatically polyfilled via `fake-indexeddb/auto` in:
- `app/test/setup/indexeddb.ts` - Imported in vitest.component.config.ts
- Auto-imported at top of `renderHelpers.tsx` for direct usage

**Features:**
- Automatic reset between tests (clean slate each test)
- Full IndexedDB API support
- Works with Zustand persist middleware
- No manual setup needed in tests

## Testing Pattern (Current Implementation)

Our testing approach separates pure logic from component rendering for optimal test speed and clarity:

1. **Extract logic**: Move complex calculations to pure functions (e.g., `recipeNodeLogic.ts`)
2. **Test logic separately**: Unit test pure functions with `.test.ts` (fast, no DOM, no mocking)
3. **Test components**: Use React Testing Library for rendering and interactions with `.component.test.tsx`

### Example: RecipeNode Testing

**Pure Logic** (`recipeNodeLogic.ts`):
```typescript
export function calculateIOCounts(recipe: Recipe): { inputs: number; outputs: number } {
  return {
    inputs: recipe.inputs.length,
    outputs: recipe.outputs.length
  };
}

export function findHandlePositions(recipe: Recipe, ltr: boolean): HandlePositions {
  // Pure calculation of handle positions based on recipe and orientation
}
```

**Unit Tests** (`recipeNodeLogic.test.ts` - 7 tests):
```typescript
describe('calculateIOCounts', () => {
  it('counts inputs and outputs correctly', () => {
    const recipe = recipes.get('WheatMilling');
    const counts = calculateIOCounts(recipe);
    expect(counts.inputs).toBe(1);
    expect(counts.outputs).toBe(2);
  });
});
```

**Component Tests** (`RecipeNode.component.test.tsx` - 17 tests):

```typescript
import { screen } from '@testing-library/react';
import { renderWithFactory } from '~/test/helpers/renderHelpers';
import RecipeNode from './RecipeNode';

describe('RecipeNode', () => {
  it('renders machine name and title bar', () => {
    const props = createNodeProps({ recipeId: 'PowerGeneratorT2', ltr: true });
    const { container } = renderWithFactory(<RecipeNode {...props} />);

    // Validate DOM structure
    expect(container.querySelector('.recipe-node-title-bar')).toBeInTheDocument();
    expect(screen.getByText(/Power generator/i)).toBeInTheDocument();
  });

  it('displays correct number of input/output ports', () => {
    const props = createNodeProps({ recipeId: 'WheatMilling', ltr: true });
    renderWithFactory(<RecipeNode {...props} />, { withReactFlow: true });
    
    // WheatMilling has 1 input, 2 outputs
    const handles = document.querySelectorAll('[data-handleid]');
    expect(handles).toHaveLength(3);
  });
  
  it('handles ltr/rtl orientation', () => {
    const propsLtr = createNodeProps({ recipeId: 'WheatMilling', ltr: true });
    const propsRtl = createNodeProps({ recipeId: 'WheatMilling', ltr: false });
    
    const { container: ltrContainer } = renderWithFactory(<RecipeNode {...propsLtr} />);
    const { container: rtlContainer } = renderWithFactory(<RecipeNode {...propsRtl} />);
    
    // Verify different layouts
    expect(ltrContainer.innerHTML).not.toBe(rtlContainer.innerHTML);
  });
});
```

### Current Test Coverage

**Implemented Tests:**
- ✅ `recipeNodeLogic.test.ts` - 7 unit tests (pure logic)
- ✅ `RecipeNode.component.test.tsx` - 17 component tests
- ✅ `RecipeNodeView.component.test.tsx` - Component rendering tests
- ✅ `graphReducers.test.ts` - 50+ store reducer tests

**Test Categories Covered:**
- Rendering (title bar, machine name, ports)
- Solution data display
- Orientation handling (ltr/rtl)
- Handle positioning
- React Flow integration
- Store mutations

### Mock React Flow (Current Implementation)

React Flow hooks and components are mocked for component tests to avoid rendering complexity:

```typescript
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    useUpdateNodeInternals: () => vi.fn(),
    useStore: vi.fn(() => false),  // Default: not hovering
    Handle: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  };
});
```

**Why Mock?**
- React Flow requires full initialization which is slow in tests
- Most component logic doesn't depend on React Flow internals
- Mocking focuses tests on component behavior, not React Flow integration
- `withReactFlow: true` option available when full provider needed

## Current Examples

**Fully Implemented:**
- `app/factory/graph/recipeNodeLogic.test.ts` - Pure logic tests (7 tests)
- `app/factory/graph/RecipeNode.component.test.tsx` - Component tests (17 tests)
- `app/factory/graph/RecipeNodeView.component.test.tsx` - Component view tests

**Patterns Established:**
- Pure function extraction for business logic
- Component tests focus on rendering and interactions
- Helper functions simplify test setup
- Mocking strategy for complex dependencies (React Flow)

## Running Tests (Current Commands)

```bash
# Fast unit tests only (Node environment, no jsdom)
npm test

# Component tests only (jsdom environment)
npm run test:component

# All tests (unit + component)
npm run test:all

# Specific test file (unit test)
npm test -- recipeNodeLogic

# Specific test file (component test)
npm run test:component -- RecipeNode

# Watch mode (unit tests)
npm test -- --watch

# Watch mode (component tests)
npm run test:component -- --watch

# Coverage report (unit tests)
npm test -- --coverage

# Coverage report (component tests)
npm run test:component -- --coverage
```

## Adding New Component Tests

Follow this pattern for new components:

1. **Extract pure logic** to separate file (e.g., `myComponentLogic.ts`)
2. **Create unit tests** for pure logic (`myComponentLogic.test.ts`)
3. **Create component tests** for rendering (`MyComponent.component.test.tsx`)
4. **Use helpers** from `renderHelpers.tsx` for setup
5. **Mock external dependencies** as needed (follow RecipeNode example)

### Template for New Component Test

```typescript
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithFactory } from '~/test/helpers/renderHelpers';
import MyComponent from './MyComponent';

// Mock external dependencies if needed
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return { ...actual, /* mocks */ };
});

describe('MyComponent', () => {
  it('renders without crashing', () => {
    renderWithFactory(<MyComponent />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    renderWithFactory(<MyComponent />);
    // Add interaction tests
  });
});
```

## Best Practices (Current Implementation)

✅ **DO:**
- Extract complex logic to pure functions
- Test pure functions separately with `.test.ts`
- Use `renderWithFactory()` for components needing context
- Mock external dependencies (React Flow, etc.) for speed
- Use real recipe IDs from `gameData.ts` in tests
- Write descriptive test names
- Group related tests with `describe()` blocks

❌ **DON'T:**
- Mix unit and component tests in same file
- Over-mock (use real data when possible)
- Test implementation details (test behavior, not internals)
- Skip cleanup between tests (handled automatically)
- Forget to await async operations

## Future Expansion

The infrastructure is ready for testing additional components. Priority candidates:
- `RecipePicker` - Recipe search and selection
- `ButtonEdge` - Product flow selection
- `Manifold` - Manifold controls
- `FactoryControls` - Factory control panel
- `InfrastructurePopover` - Infrastructure breakdown display

Follow the established patterns in RecipeNode tests when expanding coverage.
