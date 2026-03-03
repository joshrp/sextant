import { useRef, type ReactNode } from "react";
import { FactoryContext } from "../factory/FactoryContext";
import type { ProductionZoneStoreData } from "./ZoneStore";
import Store, { type FactoryStore, type GetZoneModifiers } from "../factory/store";
import type { IDB } from "./idb";

interface FactoryProviderProps {
  idb: IDB;
  zoneId: string;
  children: ReactNode;
  id: string;
  name: string;
  weights: ProductionZoneStoreData["weights"];
  getZoneModifiers: GetZoneModifiers;
}

const storeCache = {} as Record<string, { store: FactoryStore }>;

export const FactoryProvider = ({ children, idb, id = "default-factory", zoneId, name, weights, getZoneModifiers }: FactoryProviderProps) => {
  const storeRef = useRef<FactoryStore | null>(null);
  const cacheId = zoneId + id;
  if (storeCache[cacheId]) {
    storeRef.current = storeCache[cacheId].store;
    storeRef.current.Graph.getState().setBaseWeights(weights);
  } else {
    storeRef.current = Store(idb, { id, name }, getZoneModifiers);
    storeRef.current?.Graph.persist.onFinishHydration(state => state.setBaseWeights(weights));
    storeCache[cacheId] = { store: storeRef.current }; // Placeholder, will be set below
  }

  return (
    <FactoryContext.Provider value={{ 
      store: storeRef.current?.Graph, 
      historical: storeRef.current?.Historical,
      id, name
    }}>
      {children}
    </FactoryContext.Provider>
  );
};
