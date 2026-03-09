import { fixtures, getTestStoreRunner } from '~/factory/fixtures';
import { getFactoryWrapper, getRouterWrapper } from '~/test/helpers/renderHelpers';
import ConstructionCostsPopover from './ConstructionCostsPopover';
import { useFixtureSelect } from 'react-cosmos/client';

const createFixture = (
  id: string,
  stateOverrides?: {
    solutionStatus?: 'Solved' | 'Partial' | 'Infeasible';
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
  const [store, prom] = getTestStoreRunner('construction-costs-' + id, fixture);
  prom.then(() => {
    store.Graph.setState({
      ...stateOverrides,
    });
  });

  return getRouterWrapper(
    getFactoryWrapper(
      <div className="p-4 bg-gray-900 flex justify-center">
        <ConstructionCostsPopover />
      </div>,
      {
        store,
        factoryId: 'test-construction-costs-' + id,
        factoryName: 'Test Construction Costs ' + id,
        withReactFlow: false,
      }
    ),
    { initialEntries: ['/zones/test-zone/test-factory'] }
  );
};

export default {
  'Solved': () => createFixture('solved', {
    solutionStatus: 'Solved',
  }),

  'Partial': () => createFixture('partial', {
    solutionStatus: 'Partial',
  }),

  'Infeasible': () => createFixture('infeasible', {
    solutionStatus: 'Infeasible',
  }),
};
