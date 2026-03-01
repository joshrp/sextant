import { useRef, type ReactNode } from "react";
import { ProductionZoneContext } from "./ZoneContext";
import type { GraphCoreData, GraphImportData } from "~/factory/store";
import FactoryStore from "../factory/store";
import { getIdb, deleteFactoryFromIdb, type IDB } from "./idb";
import {
  archiveFactory as archiveFactoryToIdb,
  listArchivedFactories as listArchivedFactoriesFromIdb,
  restoreArchivedFactory as restoreArchivedFactoryFromIdb,
  deleteArchivedFactory as deleteArchivedFactoryFromIdb,
} from "./factoryArchive";
import { getCachedZoneStore, setCachedZoneStore } from "./zoneCache";
import { factoryIdFromName } from "./utils";
import { createZoneStore } from "./ZoneStore";
import type { ProductionZoneStore } from "./ZoneStore";
export type { ProductionZoneStore, ProductionZoneStoreData } from "./ZoneStore";

export const ProductionZoneProvider = ({ zoneId, zoneName, children }: { zoneId: string, zoneName: string, children: ReactNode }) => {
  const storeRef = useRef<ProductionZoneStore | null>(null);
  const idbRef = useRef<IDB | null>(null);

  const cached = getCachedZoneStore(zoneId);
  if (cached) {
    console.log("Reusing cached store for zone", zoneId);
    storeRef.current = cached.store;
    idbRef.current = cached.idb;
  } else {
    console.log("Production Zone Store initialized for", zoneId);
    idbRef.current = getIdb(zoneId);
    storeRef.current = createZoneStore(idbRef.current!, { id: zoneId, name: zoneName });
    setCachedZoneStore(zoneId, storeRef.current, idbRef.current!);
  }

  return (
    <ProductionZoneContext.Provider value={{
      idb: idbRef.current!,
      store: storeRef.current,
      id: zoneId,
      name: zoneName,
      // Import a factory by creating a new Zuhstand store for it, and running the import there.
      // If that works, add it to the list of factories in this zone.
      importFactory: (data: GraphImportData) => {
        if (!storeRef.current) return;
        if (!idbRef.current) return;

        const id = factoryIdFromName(data.name);
        if (storeRef.current?.getState().factories.find(f => f.id === id))
          throw new Error("Factory with this ID already exists: " + id);

        const newStore = FactoryStore(idbRef.current!, { id, name: data.name })
        newStore.Graph.getState().importData(data);

        storeRef.current.getState().newFactory(data.name, id);
      },

      // Archive a factory: minify, compress, and store in archive DB
      archiveFactory: async (factoryId: string, factoryData: GraphCoreData) => {
        if (!storeRef.current) throw new Error("Store not initialized");
        if (!idbRef.current) throw new Error("IDB not initialized");

        const factory = storeRef.current.getState().factories.find(f => f.id === factoryId);
        if (!factory) throw new Error("Factory not found: " + factoryId);

        return archiveFactoryToIdb(idbRef.current, factoryData, zoneName, {
          id: factory.id,
          icon: factory.icon,
          description: factory.description,
        });
      },

      // Restore a factory from archive
      restoreFactory: async (archiveId: string) => {
        if (!storeRef.current) throw new Error("Store not initialized");
        if (!idbRef.current) throw new Error("IDB not initialized");

        const data = await restoreArchivedFactoryFromIdb(idbRef.current, archiveId);

        // Create new factory ID (may be different from archive ID if name collision)
        let newId = factoryIdFromName(data.name);
        if (storeRef.current.getState().factories.find(f => f.id === newId)) {
          newId = newId + "-" + Date.now().toString().slice(-4);
        }

        const newStore = FactoryStore(idbRef.current, { id: newId, name: data.name });
        await newStore.Graph.getState().importData(data);

        storeRef.current.getState().newFactory(data.name, newId);

        return newId;
      },

      // Remove factory from active list (does not archive)
      deleteFactory: async (factoryId: string) => {
        if (!storeRef.current) return;
        if (!idbRef.current) return;
        await deleteFactoryFromIdb(idbRef.current, factoryId);
        storeRef.current.getState().removeFactory(factoryId);
      },

      // List all archived factories
      listArchivedFactories: async () => {
        if (!idbRef.current) return [];
        return listArchivedFactoriesFromIdb(idbRef.current);
      },

      // Permanently delete from archive
      deleteArchivedFactory: async (archiveId: string) => {
        if (!idbRef.current) return;
        return deleteArchivedFactoryFromIdb(idbRef.current, archiveId);
      },
    }}>
      {children}
    </ProductionZoneContext.Provider>
  );
};



