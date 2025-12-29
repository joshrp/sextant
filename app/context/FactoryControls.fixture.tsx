import FactoryControls from './FactoryControls';
import { createTestFactoryStore, getFactoryWrapper, getRouterWrapper } from '~/test/helpers/renderHelpers';
import type { Solution } from '~/factory/solver/types';
import type { ProductId } from '~/factory/graph/loadJsonData';

const factoryId = 'test-factory-controls';
const factoryName = 'Test Factory Controls';

// Create a mock solution with infrastructure data
const mockSolution: Solution = {
  ObjectiveValue: 1250.5,
  manifolds: {},
  nodeCounts: [],
  scoringMethod: 'infra',
  goals: [],
  infrastructure: {
    electricity: 2500,
    workers: 120,
    maintenance_1: 45,
    maintenance_2: 15,
    maintenance_3: 5,
    computing: 850,
    footprint: 480,
  },
  products: {
    inputs: [
      { productId: 'Product_IronOre' as ProductId, amount: 50 },
      { productId: 'Product_Coal' as ProductId, amount: 30 },
    ],
    outputs: [
      { productId: 'Product_IronScrap' as ProductId, amount: 45 },
      { productId: 'Product_Diesel' as ProductId, amount: 25 },
    ],
  },
};

// Helper to create a fixture with a specific state
const createFixture = (
  id: string,
  stateOverrides: {
    solution?: Solution;
    solutionStatus?: 'Solved' | 'Infeasible' | 'Running';
    scoringMethod?: 'infra' | 'inputs' | 'footprint' | 'outputs';
  }
) => {
  const store = createTestFactoryStore(factoryId + id, factoryName);
  store.Graph.setState({
    goals: [],
    ...stateOverrides,
  });

  return getRouterWrapper(
    getFactoryWrapper(
      <div className='h-10 flex'>
        <FactoryControls />
      </div>,
      {
        store,
        factoryId: factoryId + id,
        factoryName,
        withReactFlow: false,
      }
    ),
    { initialEntries: ['/zones/test-zone/test-factory'] }
  );
};

export default {
  'Solved - Infrastructure Scoring': () => createFixture('', {
    solution: mockSolution,
    solutionStatus: 'Solved',
    scoringMethod: 'infra',
  }),

  'Solved - Inputs Scoring': () => createFixture('-inputs', {
    solution: mockSolution,
    solutionStatus: 'Solved',
    scoringMethod: 'inputs',
  }),

  'Solved - Footprint Scoring': () => createFixture('-footprint', {
    solution: mockSolution,
    solutionStatus: 'Solved',
    scoringMethod: 'footprint',
  }),

  'Infeasible State': () => createFixture('-infeasible', {
    solutionStatus: 'Infeasible',
    scoringMethod: 'infra',
  }),

  'Running State': () => createFixture('-running', {
    solutionStatus: 'Running',
    scoringMethod: 'inputs',
  }),
};
