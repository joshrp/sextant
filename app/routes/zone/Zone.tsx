import { useMemo, useState } from "react";
import { Outlet } from "react-router";

import FactoryArchiveHandler from "~/components/FactoryArchiveHandler";
import FactoryControls from "~/context/FactoryControls";
import { FactoryProvider } from "~/context/FactoryProvider";
import useProductionZone, { useProductionZoneStore } from "~/context/ZoneContext";
import { Factory } from "~/factory/factory";
import { useStableParam } from "~/routes";
import ZoneSideBar from "./ZoneSideBar";

export default function Zone() {
  let selectedFactoryId = useStableParam("factory", "");

  const baseWeights = useProductionZoneStore(state => state.weights);
  const factories = useProductionZoneStore(state => state.factories);
  const zoneId = useProductionZone().id;
  const store = useProductionZone().store;

  if (selectedFactoryId === "") {
    if (factories.length === 0)
      selectedFactoryId = store.getState().newFactory("Default Factory");
    else
      selectedFactoryId = store.getState().lastFactory || factories[0]?.id;
    history.replaceState({}, "", `/zones/${zoneId}/${selectedFactoryId}`);
  }

  const selectedFactory = factories.find(f => f.id === selectedFactoryId);
  store.getState().setLastFactory(selectedFactoryId);
  const idb = useProductionZone().idb;

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
      <FactoryProvider idb={idb} zoneId={zoneId} id={selectedFactoryId} name={selectedFactory?.name || "Default Factory"} weights={baseWeights}>
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
