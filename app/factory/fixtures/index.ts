import { getIdb } from '~/context/idb';
import { unminify } from '../importexport/importexport';
import type { GraphScoringMethod, ManifoldOptions, Solution } from '../solver/types';
import Store from '../store';
import { DEFAULT_ZONE_MODIFIERS } from '~/context/zoneModifiers';
import type { ZoneModifiers } from '~/context/zoneModifiers';
import * as nuclearT2AndFBR from './nuclear-t2-and-FBR.test.fixture.json';
import * as nuclearT2 from './nuclear-T2.test.fixture.json';
import * as powerGenerationSteam from './power-generation-steam.test.fixture.json';
import * as researchT2 from './research-t2-simple.test.fixture.json';
import * as steamFreed from './steam-freed-manifold.test.fixture.json';
import * as settlement from './basic-settlement-potato-waste-water.test.fixture.json';
import * as farming from './farming-fertilizer.test.fixture.json';

/**
 * Test data format for solver tests using the import/export system
 */
export interface FactoryFixture {
  /** Optional description of what this test fixture represents */
  description?: string;
  /** Minified factory data (same format as import/export) */
  factory: unknown; // MinifiedState
  /** Manifold options for the test */
  manifoldOptions?: ManifoldOptions[];
  /** Scoring method to use */
  scoringMethod: GraphScoringMethod;
  /** Objective value of previous solution for autosolving */
  previousSolutionObjectiveValue?: number;
  /** Expected solution outputs */
  expected?: {
    objectiveValue: number;
    nodeCounts?: Array<{ nodeId: string; count: number }>;
    infrastructure?: Partial<Solution["infrastructure"]>;
    products?: Solution["products"];
    manifolds?: Solution["manifolds"];
  };
}

export const fixtures: { [name: string]: FactoryFixture } = {
  'nuclear-T2': nuclearT2 as unknown as FactoryFixture,
  'nuclear-t2-and-fbr': nuclearT2AndFBR as unknown as FactoryFixture,
  'power-generation-steam': powerGenerationSteam as unknown as FactoryFixture,
  'research-t2-simple': researchT2 as unknown as FactoryFixture,
  'steam-freed-manifold': steamFreed as unknown as FactoryFixture,
  'basic-settlement-potato-waste-water': settlement as unknown as FactoryFixture,
  'farming-fertilizer': farming as unknown as FactoryFixture,
};

/**
 * 
 * @param id 
 * @param fixture JSON Loaded test fixture
 * @returns A tuple of the store to use immediately, and a promise that resolves when import is complete
 */
export function getTestStoreRunner(id: string, fixture: FactoryFixture, getZoneModifiers?: () => ZoneModifiers) {
  const mockIDB = getIdb(id);
  if (!mockIDB) {
    throw new Error("Failed to create mock IndexedDB for testing");
  }
  // Clear existing data
  mockIDB.then(idb => idb.clear('factories'));

  // Unminify the factory data
  const factoryData = unminify(fixture.factory);
  // Create a new store instance
  const store = Store(mockIDB, { id, name: factoryData.name }, getZoneModifiers ?? (() => DEFAULT_ZONE_MODIFIERS));
  
  store.Graph.setState({
    scoringMethod: fixture.scoringMethod,
    manifoldOptions: fixture.manifoldOptions ? fixture.manifoldOptions : undefined,
    solution: (fixture.previousSolutionObjectiveValue ? {
      ObjectiveValue: fixture.previousSolutionObjectiveValue,
      infrastructure: {
        workers: 0,
        electricity: 0,
        computing: 0,
        maintenance_1: 0,
        maintenance_2: 0,
        maintenance_3: 0,
        footprint: 0,
        workers_generated: 0,
        electricity_generated: 0,
        computing_generated: 0,
        maintenance_1_generated: 0,
        maintenance_2_generated: 0,
        maintenance_3_generated: 0,
      },
      nodeCounts: [],
      products: { inputs: [], outputs: [] },
      goals: [],
      scoringMethod: fixture.scoringMethod,
      manifolds: {}
    } : undefined)
  }, false, 'set previous solution');

  return [store, store.Graph.getState().importData(factoryData)] as const;
}
