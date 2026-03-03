import { useEffect } from 'react';
import { getRouterWrapper, getZoneWrapper } from '~/test/helpers/renderHelpers';
import { useProductionZoneStore } from '~/context/ZoneContext';
import ZoneModifiersPane from './ZoneModifiersPane';

function SetModifiersHelper() {
  const setModifier = useProductionZoneStore(s => s.setModifier);
  useEffect(() => {
    // Set some non-default values so the "modified" state is visible
    setModifier('recyclingEfficiency', 0.75);
    setModifier('foodConsumption', 0.70);
    setModifier('maintenanceConsumption', 0.85);
    setModifier('contractProfitability', 1.20);
  }, []);
  return null;
}

function ModifiedWrapper() {
  return (
    <>
      <SetModifiersHelper />
      <ZoneModifiersPane />
    </>
  );
}

const paneContainer = (children: React.ReactElement) => (
  <div style={{ background: '#111827', padding: '24px', maxWidth: '600px' }}>
    {children}
  </div>
);

export default {
  'Default (all at defaults)': () =>
    getRouterWrapper(
      getZoneWrapper(
        paneContainer(<ZoneModifiersPane />),
        { zoneId: 'modifiers-fixture-default', zoneName: 'Iron Production' }
      )
    ),

  'Modified (some values changed)': () =>
    getRouterWrapper(
      getZoneWrapper(
        paneContainer(<ModifiedWrapper />),
        { zoneId: 'modifiers-fixture-modified', zoneName: 'Advanced Materials' }
      )
    ),
};
