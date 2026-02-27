import { fixtures, getTestStoreRunner } from '~/factory/fixtures';
import { getFactoryWrapper, getRouterWrapper } from '~/test/helpers/renderHelpers';
import FactoryControls from './FactoryControls';
import { useFixtureSelect } from 'react-cosmos/client';

// Helper to create a fixture with a specific state
const createFixture = (
  id: string,
  stateOverrides?: {
    solutionStatus?: 'Solved' | 'Infeasible' | 'Running';
    scoringMethod?: 'infra' | 'inputs' | 'footprint' | 'outputs';
  },
  fixtureNameInit?: string,
) => {
  const fixtureName = useFixtureSelect('fixture', {
    defaultValue: fixtureNameInit,
    options: Object.keys(fixtures),
  })[0];

  const fixture = fixtures[fixtureName];

  if (!fixture) {
    throw new Error(`Fixture ${fixtureName} not found`);
  }
  const [store, prom] = getTestStoreRunner('factory-controls-' + id, fixture);
  console.log('Created store for fixture', fixtureName);
  prom.then(() => {
    store.Graph.setState({
      goals: [],
      ...stateOverrides,
    });
  });

  return getRouterWrapper(
    getFactoryWrapper(
      <div className='h-10 flex'>
        <FactoryControls addNewRecipe={() => {}} addAnnotationNode={() => {}} />
      </div>,
      {
        store,
        factoryId: 'test-factory-controls' + id,
        factoryName : 'Test Factory Controls' + id,
        withReactFlow: false,
      }
    ),
    { initialEntries: ['/zones/test-zone/test-factory'] }
  );
};

export default {
  'Solved - Infrastructure Scoring': () => createFixture('', {
    
    solutionStatus: 'Solved',
    scoringMethod: 'infra',
  }),

  'Solved - Inputs Scoring': () => createFixture('-inputs', {
    solutionStatus: 'Solved',
    scoringMethod: 'inputs',
  }),

  'Solved - Footprint Scoring': () => createFixture('-footprint', {
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
