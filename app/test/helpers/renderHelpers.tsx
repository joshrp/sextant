/**
 * Test helpers for rendering React components with proper context
 */
import { render, type RenderOptions } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import 'fake-indexeddb/auto';
import type { ReactElement, ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { getIdb } from '~/context/idb';
import { ProductionZoneProvider } from '~/context/ZoneProvider';
import { DEFAULT_ZONE_MODIFIERS } from '~/context/zoneModifiers';
import { FactoryContext } from '~/context/FactoryContext';
import Store, { type FactoryStore, type GetZoneModifiers } from '~/context/store';

/**
 * Creates a test factory store with default values
 */
export function createTestFactoryStore(
  id = 'test-factory',
  name = 'Test Factory',
  getZoneModifiers: GetZoneModifiers = () => DEFAULT_ZONE_MODIFIERS,
): FactoryStore {
  const idb = getIdb(id);
  if (!idb) {
    throw new Error('Failed to create IndexedDB instance for test factory store');
  }
  return Store(idb, { id, name }, getZoneModifiers);
}

interface RenderWithFactoryOptions extends Omit<RenderOptions, 'wrapper'> {
  store?: FactoryStore;
  factoryId?: string;
  factoryName?: string;
  withReactFlow?: boolean;
}

/**
 * Renders a component with FactoryContext provider
 * Useful for testing components that use useFactory or useFactoryStore hooks
 * 
 * @param ui - The component to render
 * @param options.store - Optional pre-configured store
 * @param options.factoryId - Factory ID for the context
 * @param options.factoryName - Factory name for the context
 * @param options.withReactFlow - Whether to wrap with ReactFlowProvider (default: false)
 * @returns Render result with store reference
 */
export function renderWithFactory(
  ui: ReactElement,
  {
    store,
    factoryId = 'test-factory',
    factoryName = 'Test Factory',
    withReactFlow = false,
    ...options
  }: RenderWithFactoryOptions = {}
) {
  const testStore = store || createTestFactoryStore(factoryId, factoryName);

  function Wrapper({ children }: { children: ReactNode }) {
    return getFactoryWrapper(
      <>{children}</>,
      { store: testStore, factoryId, factoryName, withReactFlow }
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...options }), store: testStore };
}

export function getFactoryWrapper(
  children: ReactElement,
  {
    store,
    factoryId = 'test-factory',
    factoryName = 'Test Factory',
    withReactFlow = false,
  }: RenderWithFactoryOptions = {}) {
  const testStore = store || createTestFactoryStore(factoryId, factoryName);

  const content = <FactoryContext.Provider
    value={{
      store: testStore.Graph,
      historical: testStore.Historical,
      id: factoryId,
      name: factoryName,
    }}
  >
    {children}
  </FactoryContext.Provider>

  // Optionally wrap with ReactFlowProvider for components that need it
  if (withReactFlow) {
    return <ReactFlowProvider>{content}</ReactFlowProvider>;
  }

  return content;
}

interface RouterWrapperOptions {
  initialEntries?: string[];
  initialIndex?: number;
}

/**
 * Wraps a component with a MemoryRouter for testing components that use routing
 * 
 * @param children - The component to wrap
 * @param options.initialEntries - Initial browser history stack (default: ['/'])
 * @param options.initialIndex - Index of initial entry (default: 0)
 * @returns Component wrapped with RouterProvider
 */
export function getRouterWrapper(
  children: ReactElement,
  {
    initialEntries = ['/'],
    initialIndex = 0,
  }: RouterWrapperOptions = {}
) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: children,
      },
    ],
    {
      initialEntries,
      initialIndex,
    }
  );

  return <RouterProvider router={router} />;
}

/**
 * Wraps a component with ProductionZoneProvider for testing components that use zone context
 * 
 * @param children - The component to wrap
 * @param zoneId - Zone ID (default: 'test-zone')
 * @param zoneName - Zone name (default: 'Test Zone')
 * @returns Component wrapped with ProductionZoneProvider
 */
export function getZoneWrapper(
  children: ReactElement,
  {
    zoneId = 'test-zone',
    zoneName = 'Test Zone',
  }: { zoneId?: string; zoneName?: string } = {}
) {
  return (
    <ProductionZoneProvider zoneId={zoneId} zoneName={zoneName}>
      {children}
    </ProductionZoneProvider>
  );
}
