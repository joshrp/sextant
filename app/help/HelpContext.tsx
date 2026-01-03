/**
 * HelpProvider - Isolated context for help examples
 * 
 * This provider creates a completely isolated Zone and Factory environment
 * for the Help Hub, allowing it to display working examples without
 * affecting the main application state.
 */

/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, type ReactNode, useMemo, useState, useEffect } from 'react';
import { getIdb } from '~/context/idb';
import Store, { type FactoryStore } from '~/factory/store';
import type { GraphImportData } from '~/factory/store';

// Help context uses a minimal zone structure for examples
interface HelpContextValue {
  factoryStore: FactoryStore | null;
  loadFixture: (fixtureData: GraphImportData) => Promise<void>;
  clearFixture: () => void;
  isLoading: boolean;
}

const HelpContext = createContext<HelpContextValue | null>(null);

interface HelpProviderProps {
  children: ReactNode;
}

const HELP_FACTORY_ID = '__help_example_factory__';
const HELP_FACTORY_NAME = 'Help Example Factory';

export function HelpProvider({ children }: HelpProviderProps) {
  const [factoryStore, setFactoryStore] = useState<FactoryStore | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize the help factory store
  useEffect(() => {
    const idb = getIdb(HELP_FACTORY_ID);
    if (!idb) {
      console.error('Failed to create IndexedDB for help factory');
      return;
    }
    
    const store = Store(idb, { 
      id: HELP_FACTORY_ID, 
      name: HELP_FACTORY_NAME 
    });
    
    setFactoryStore(store);
    
    return () => {
      // Cleanup if needed
    };
  }, []);

  const loadFixture = async (fixtureData: GraphImportData) => {
    if (!factoryStore) return;
    
    setIsLoading(true);
    try {
      // Use the importData method which handles everything
      await factoryStore.Graph.getState().importData(fixtureData);
    } catch (error) {
      console.error('Error loading help fixture:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearFixture = () => {
    if (!factoryStore) return;
    factoryStore.Graph.setState({
      nodes: [],
      edges: [],
      goals: [],
      graph: undefined,
      solution: undefined,
    }, false, 'clearFixture');
  };

  const value = useMemo(
    () => ({
      factoryStore,
      loadFixture,
      clearFixture,
      isLoading,
    }),
    [factoryStore, isLoading]
  );

  return (
    <HelpContext.Provider value={value}>
      {children}
    </HelpContext.Provider>
  );
}

export function useHelp() {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error('useHelp must be used within HelpProvider');
  }
  return context;
}
