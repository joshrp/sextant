import { useEffect, useState } from "react";
import { Link } from "react-router";

import { usePlannerStore } from "~/context/PlannerContext";
import { ProductionZoneProvider } from "~/context/ZoneProvider";
import { loadData } from "~/factory/graph/loadJsonData";
import { useStableParam } from "~/routes";
import { machineIcon, productIcon, uiIcon } from "~/uiUtils";
import { Zone, ZoneHeader } from "./zone";


const { products, machines } = loadData();

export default function Home() {
  const selectedZone = useStableParam("zone");
  const zones = usePlannerStore(state => state.zones);
  const zone = zones.find(z => z.id === selectedZone);
  const setLastZone = usePlannerStore(state => state.setLastZone);

  const [images, setImages] = useState<string[]>([]);
  useEffect(() => {
    const newImg = Array.from(products.values().map(p => productIcon(p.icon)));
    newImg.push(...Array.from(machines.values().map(m => machineIcon(m))));
    newImg.push(uiIcon("Worker"));
    newImg.push(uiIcon("Electricity"));
    newImg.push(uiIcon("Workers"));
    newImg.push(uiIcon("Computing"));
    newImg.push(uiIcon("Maintenance"));
    setImages(newImg);
  }, [products, machines]);

  // Update last used zone whenever zone changes
  useEffect(() => {
    if (zone) {
      setLastZone(selectedZone);
    }
  }, [selectedZone, zone, setLastZone]);
  const headerHeightSteps = 12;
  return <>
    <main className="h-screen w-screen overflow-hidden bg-gray-800">
      <div className={`max-w-screen h-${headerHeightSteps} p-2 flex flex-row gap-2 items-center text-gray-300 texture-panel`}>
        <ZoneHeader selectedZone={selectedZone} />
      </div>
      {zone && (
        <ProductionZoneProvider zoneId={selectedZone} zoneName={zone.name}>
          <div className={`h-[calc(100vh-calc(12*var(--spacing)))] flex flex-row`}>
            <Zone />
          </div>
        </ProductionZoneProvider>
      )}
      {!zone && (selectedZone === "") &&
        <div className="flex-1 flex flex-col justify-center-safe items-center-safe bg-zinc-950">
          <h2 className="text-2xl mb-4">No Zone Selected</h2>
          <p>Please select or create a zone</p>
        </div>
      }
      {!zone && (selectedZone !== "") &&
        <div className="flex-1 flex flex-col justify-center-safe items-center-safe bg-zinc-950">
          <h2 className="text-2xl mb-4">Zone Not Found</h2>
          <p>The selected zone &quot;{selectedZone}&quot; was not found.</p>
          <Link
            to={zones.length > 0 ? `/zones/${zones[0].id}` : "/zones/main"}
            className="mt-4 text-blue-400 hover:text-blue-300 underline">
            {zones.length > 0 ? `Go to ${zones[0].name}` : "Go to main zone"}
          </Link>
        </div>
      }
      {images.map((img, idx) => (
        <link key={idx} rel="preload" href={img} as="image" />
      ))}
    </main >
  </>
}
