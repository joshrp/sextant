import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router";

import FactoryArchiveHandler from "~/components/FactoryArchiveHandler";
import { FactoryProvider } from "~/context/FactoryProvider";
import useProductionZone, { useProductionZoneStore } from "~/context/ZoneContext";
import { Factory } from "~/factory/factory";
import { useStableParam } from "~/routes";
import ZoneSideBar from "./ZoneSideBar";

export default function Zone() {
  const nav = useNavigate();
  let selectedFactoryId = useStableParam("factory", "");

  const baseWeights = useProductionZoneStore(state => state.weights);
  const factories = useProductionZoneStore(state => state.factories);
  const zoneId = useProductionZone().id;
  const store = useProductionZone().store;

  // Compute the redirect target if the factory param is missing or stale
  let redirectTarget: string | null = null;

  if (selectedFactoryId === "" && factories.length > 0) {
    selectedFactoryId = store.getState().lastFactory || factories[0]?.id;
    redirectTarget = `/zones/${zoneId}/${selectedFactoryId}`;
  }

  let selectedFactory = factories.find(f => f.id === selectedFactoryId);

  // If the selected factory no longer exists (e.g. the onboarding placeholder was removed)
  // but other factories are available, redirect to the first available one.
  if (!selectedFactory && factories.length > 0 && selectedFactoryId !== "") {
    selectedFactoryId = store.getState().lastFactory ?? factories[0].id;
    selectedFactory = factories.find(f => f.id === selectedFactoryId);
    redirectTarget = `/zones/${zoneId}/${selectedFactoryId}`;
  }

  // Perform the redirect in an effect to avoid re-render loops
  useEffect(() => {
    if (redirectTarget) {
      nav(redirectTarget, { replace: true });
    }
  }, [redirectTarget, nav]);

  store.getState().setLastFactory(selectedFactoryId);
  const idb = useProductionZone().idb;

  const getZoneModifiers = useCallback(() => store.getState().modifiers, [store]);

  // State for archiving the selected factory
  const [archiveRequested, setArchiveRequested] = useState(false);

  return useMemo(() => <>
    <div className="shrink-1 h-full">
      <ZoneSideBar
        selectedFactoryId={selectedFactoryId}
        onArchiveSelected={() => setArchiveRequested(true)}
      />
    </div>
    {selectedFactory &&
      <FactoryProvider idb={idb} zoneId={zoneId} id={selectedFactoryId} name={selectedFactory?.name || "Default Factory"} weights={baseWeights} getZoneModifiers={getZoneModifiers}>
        <div className="flex-1 flex flex-col h-full">
          <Factory />
        </div>

        <Outlet />

        {/* Archive handler - inside FactoryProvider so it can access factory data */}
        {archiveRequested && (
          <FactoryArchiveHandler
            factoryId={selectedFactoryId}
            onComplete={() => setArchiveRequested(false)}
          />
        )}
      </FactoryProvider >
    } {!selectedFactory &&
      <div className="h-full flex flex-col justify-center-safe items-center-safe bg-zinc-950">
        <h2 className="text-2xl mb-4">No Factory Selected</h2>
        <p>Please select a factory from the sidebar.</p>
      </div>
    }
  </>, [baseWeights, selectedFactory, idb, archiveRequested]);
}
