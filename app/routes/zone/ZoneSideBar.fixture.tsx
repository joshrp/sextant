import ZoneSideBar from './ZoneSideBar';
import { getRouterWrapper, getZoneWrapper } from '~/test/helpers/renderHelpers';

export default {
  'Collapsed - Default Factory': () =>
    getRouterWrapper(
      getZoneWrapper(
        <div style={{ background: '#1f1f1f', padding: '20px', height: '650px' }}>
          <ZoneSideBar selectedFactoryId="default-factory" />
        </div>,
        { zoneId: 'test-zone-1', zoneName: 'Test Zone 1' }
      ),
      { initialEntries: ['/zones/test-zone-1/default-factory'] }
    ),

  'Expanded - With Multiple Factories': () => {
    // This fixture will initialize the zone and let it use defaults
    // The ZoneProvider creates a default factory automatically
    return getRouterWrapper(
      getZoneWrapper(
        <div style={{ background: '#1f1f1f', padding: '20px', height: '650px' }}>
          <ZoneSideBar selectedFactoryId="default-factory" />
        </div>,
        { zoneId: 'test-zone-2', zoneName: 'Test Zone 2' }
      ),
      { initialEntries: ['/zones/test-zone-2/default-factory'] }
    );
  },

  'With Custom Factory Selection': () =>
    getRouterWrapper(
      getZoneWrapper(
        <div style={{ background: '#1f1f1f', padding: '20px', height: '650px' }}>
          <ZoneSideBar selectedFactoryId="default-factory" />
        </div>,
        { zoneId: 'test-zone-3', zoneName: 'Test Zone 3' }
      ),
      { initialEntries: ['/zones/test-zone-3/default-factory'] }
    ),
};
