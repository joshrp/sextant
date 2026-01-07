import { useRef, type ReactNode } from "react";
import { ProductionZoneContext } from "./ZoneContext";
import { createStore } from "zustand";
import { devtools, persist, subscribeWithSelector, type StorageValue } from "zustand/middleware";
import hydration from "~/hydration";
import type { ProductId } from "../factory/graph/loadJsonData";
import type { GraphCoreData, GraphImportData } from "~/factory/store";
import FactoryStore from "../factory/store";
import { getIdb, zoneObjectStore, type IDB } from "./idb";
import {
  archiveFactory as archiveFactoryToIdb,
  listArchivedFactories as listArchivedFactoriesFromIdb,
  restoreArchivedFactory as restoreArchivedFactoryFromIdb,
  deleteArchivedFactory as deleteArchivedFactoryFromIdb,
} from "./factoryArchive";
import { getCachedZoneStore, setCachedZoneStore } from "./zoneCache";

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
    storeRef.current = Store(idbRef.current!, { id: zoneId, name: zoneName });
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

        return archiveFactoryToIdb(idbRef.current, factoryData, {
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
      deleteFactory: (factoryId: string) => {
        if (!storeRef.current) return;
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



function factoryIdFromName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export type ProductionZoneStore = ReturnType<typeof Store>;
export interface ProductionZoneStoreData {
  id: string,
  name: string,
  factories: {
    id: string,
    order: number,
    name: string,
    icon?: string,
    description?: string
  }[],
  weights: {
    base: "early" | "mid" | "late" | "end";
    products: Map<ProductId, number>;
    infrastructure: Map<string, number>;
  },
  lastFactory: string | undefined;
  productDisplayMode: "icons" | "names";
  setProductDisplayMode: (mode: "icons" | "names") => void;
  newFactory(name: string, id?: string, icon?: string, description?: string): string;
  setLastFactory(id: string): void;
  renameFactory(id: string, newName: string): void;
  updateFactory(id: string, updates: { name?: string; icon?: string; description?: string }): void;
  removeFactory(id: string): void;
};

const Store = (idb: IDB, { id, name }: { id: string, name: string }) => {
  return createStore<ProductionZoneStoreData>()(
    subscribeWithSelector(
      persist(
        devtools(
          (set, get) => ({
            id, name,
            factories: [{
              id: "default-factory",
              name: "Default Factory",
              order: 0,
            }],
            weights: {
              base: 1,
              products: new Map<ProductId, number>(),
              infrastructure: new Map<string, number>(),
            },
            lastFactory: undefined,
            productDisplayMode: "icons",
            setProductDisplayMode: (mode: "icons" | "names") => {
              set({ productDisplayMode: mode });
            },
            newFactory: (name: string, id?: string, icon?: string, description?: string) => {
              const settings = get();
              if (!id) id = factoryIdFromName(name);

              if (settings.factories.some(f => f.id === id)) {
                id = id + "-" + (new Date().getTime()).toString().slice(-4);
              }
              set({
                factories: [...settings.factories, {
                  id: id,
                  name: name.trim(),
                  order: settings.factories.length,
                  icon,
                  description
                }]
              });

              return id;
            },
            renameFactory: (id: string, newName: string) => {
              const settings = get();
              const factory = settings.factories.find(f => f.id === id);
              if (!factory) throw new Error("Factory not found");
              if (settings.factories.some(f => f.name === newName && f.id !== id)) {
                alert("Factory with this name already exists.");
                return;
              }
              factory.name = newName;
              set({
                factories: [...settings.factories]
              });
            },
            updateFactory: (id: string, updates: { name?: string; icon?: string; description?: string }) => {
              const settings = get();
              const factory = settings.factories.find(f => f.id === id);
              if (!factory) throw new Error("Factory not found");
              if (updates.name !== undefined && updates.name !== factory.name) {
                if (settings.factories.some(f => f.name === updates.name && f.id !== id)) {
                  alert("Factory with this name already exists.");
                  return;
                }
                factory.name = updates.name;
              }
              factory.icon = updates.icon;
              factory.description = updates.description;
              set({
                factories: [...settings.factories]
              });
            },
            setLastFactory: (id: string) => {
              set({ lastFactory: id });
            },
            removeFactory: (id: string) => {
              const settings = get();
              const filteredFactories = settings.factories.filter(f => f.id !== id);
              set({
                factories: filteredFactories,
                // Clear lastFactory if it was the removed factory
                lastFactory: settings.lastFactory === id ? undefined : settings.lastFactory,
              });
            }
          })
        ),
        {
          name: "current-state",
          storage: {
            getItem: async (name) => {
              // const str = localStorage.getItem('ProductionZone_settings');
              if (!idb) return null;
              const str = await (await idb).get(zoneObjectStore, name);

              if (!str) return null;
              return JSON.parse(str, hydration.reviver);
            },
            setItem: async (name, newValue: StorageValue<ProductionZoneStoreData>) => {
              if (!idb) return;
              const str = JSON.stringify(newValue, hydration.replacer);

              return (await idb).put(zoneObjectStore, str, name)
            },
            removeItem: async (name) => {
              if (!idb) return;
              return (await idb).delete(zoneObjectStore, name);
            }
          },
          version: 2,
          migrate: (persistedState: unknown, currentVersion: number) => {
            if (!persistedState || !('factories' in (persistedState as ProductionZoneStoreData))) {
              console.log("No persisted state found, or invalid, something is weird in migrate.");
              return persistedState as ProductionZoneStoreData;
            }
            const newState = persistedState as ProductionZoneStoreData;

            if (currentVersion === 1) {
              newState.weights = {
                infrastructure: new Map<string, number>(),
                products: new Map<ProductId, number>(),
                base: "early",
              };
              console.log("Migrated ProductionZone_settings from version 1 to include weights", newState);
            }

            return newState;
          }
        })
    )

  );
}


