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

export default {
  'Solved - Infrastructure Scoring': () => {
    const store = createTestFactoryStore(factoryId, factoryName);
    // Set the store to a solved state
    store.Graph.setState({
      solution: mockSolution,
      solutionStatus: 'Solved',
      scoringMethod: 'infra',
      goals: [],
    });

    return getRouterWrapper(
      getFactoryWrapper(
        <div style={{ background: '#000', height: '40px', width: '100%' }}>
          <FactoryControls />
        </div>,
        {
          store,
          factoryId,
          factoryName,
          withReactFlow: false,
        }
      ),
      { initialEntries: ['/zones/test-zone/test-factory'] }
    );
  },

  'Solved - Inputs Scoring': () => {
    const store = createTestFactoryStore(factoryId + '-inputs', factoryName);
    store.Graph.setState({
      solution: mockSolution,
      solutionStatus: 'Solved',
      scoringMethod: 'inputs',
      goals: [],
    });

    return getRouterWrapper(
      getFactoryWrapper(
        <div style={{ background: '#000', height: '40px', width: '100%' }}>
          <FactoryControls />
        </div>,
        {
          store,
          factoryId: factoryId + '-inputs',
          factoryName,
          withReactFlow: false,
        }
      ),
      { initialEntries: ['/zones/test-zone/test-factory'] }
    );
  },

  'Solved - Footprint Scoring': () => {
    const store = createTestFactoryStore(factoryId + '-footprint', factoryName);
    store.Graph.setState({
      solution: mockSolution,
      solutionStatus: 'Solved',
      scoringMethod: 'footprint',
      goals: [],
    });

    return getRouterWrapper(
      getFactoryWrapper(
        <div style={{ background: '#000', height: '40px', width: '100%' }}>
          <FactoryControls />
        </div>,
        {
          store,
          factoryId: factoryId + '-footprint',
          factoryName,
          withReactFlow: false,
        }
      ),
      { initialEntries: ['/zones/test-zone/test-factory'] }
    );
  },

  'Infeasible State': () => {
    const store = createTestFactoryStore(factoryId + '-infeasible', factoryName);
    store.Graph.setState({
      solutionStatus: 'Infeasible',
      scoringMethod: 'infra',
      goals: [],
    });

    return getRouterWrapper(
      getFactoryWrapper(
        <div style={{ background: '#000', height: '40px', width: '100%' }}>
          <FactoryControls />
        </div>,
        {
          store,
          factoryId: factoryId + '-infeasible',
          factoryName,
          withReactFlow: false,
        }
      ),
      { initialEntries: ['/zones/test-zone/test-factory'] }
    );
  },

  'Running State': () => {
    const store = createTestFactoryStore(factoryId + '-running', factoryName);
    store.Graph.setState({
      solutionStatus: 'Running',
      scoringMethod: 'inputs',
      goals: [],
    });

    return getRouterWrapper(
      getFactoryWrapper(
        <div style={{ background: '#000', height: '40px', width: '100%' }}>
          <FactoryControls />
        </div>,
        {
          store,
          factoryId: factoryId + '-running',
          factoryName,
          withReactFlow: false,
        }
      ),
      { initialEntries: ['/zones/test-zone/test-factory'] }
    );
  },
};
