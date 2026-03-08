/**
 * Example factory component for help documentation
 * Shows a React Flow graph loaded from test fixtures
 */

import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, useRef } from 'react';
import Graph from '~/factory/graph/graph';
import useFactory from '~/context/FactoryContext';
import { useHelp } from './HelpContext';
import { decompress, unminify } from '~/factory/importexport/importexport';
import type { GraphImportData } from '~/context/store';

// Import compressed test exports
import testExports from '~/factory/importexport/testExports.json';

/**
 * Simple example showing hydrogen production from steam
 * Loads from the compressed test fixture file
 */
export function HydrogenProductionExample() {
  const { store } = useFactory();
  const { loadFixture, clearFixture } = useHelp();
  
  // Load the fixture when component mounts
  useEffect(() => {
    if (!store) return;
    
    // Use the basic-nodes fixture from testExports
    const compressedData = testExports['version-1']['basic-nodes'];
    
    // Clear any existing nodes first
    clearFixture();
    
    // Decompress and load the fixture
    decompress(compressedData)
      .then((decompressed) => {
        const fixtureData: GraphImportData = unminify(decompressed);
        return loadFixture(fixtureData);
      })
      .catch((error: Error) => {
        console.error('Failed to load hydrogen production fixture:', error);
      });
    
    // Cleanup on unmount
    return () => {
      clearFixture();
    };
  }, [store, loadFixture, clearFixture]);
  
  // Empty addNewRecipe function since we don't need it for the example
  const addNewRecipe = () => {
    // No-op for example
  };
  
  // Dummy ref for smart positioning (not needed in example)
  const smartPositionRef = useRef<null>(null);

  return (
    <div className="w-full h-[500px] border-2 border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden bg-zinc-900">
      <ReactFlowProvider>
        <Graph addNewRecipe={addNewRecipe} smartPositionRef={smartPositionRef} />
      </ReactFlowProvider>
    </div>
  );
}
