import { useRef, type ReactNode } from "react";
import { ProductionZoneContext } from "./ZoneContext";
import { createStore } from "zustand";
import { devtools, persist, type StorageValue } from "zustand/middleware";
import hydration from "~/hydration";
import { openDB } from "idb";
import type { ProductId } from "../factory/graph/loadJsonData";

export const ProductionZoneProvider = ({ children }: { children: ReactNode }) => {
  const storeRef = useRef<MatrixStore | null>(null);

  if (!storeRef.current) {
    // Initialize store only once
    storeRef.current = Store();
  }
  return (
    <ProductionZoneContext.Provider value={{ store: storeRef.current }}>
      {children}
    </ProductionZoneContext.Provider>
  );
};

export type MatrixStore = ReturnType<typeof Store>;
export interface MatrixStoreData {
  factories: {
    id: string,
    order: number,
    name: string
  }[],
  selected: string,
  weights: {
    base: "early" | "mid" | "late" | "end",
    products: Map<ProductId, number>,
    infrastructure: Map<string, number>,
  },
  lastSettingsTab: string,
  changeTab(id: string): void;
  newFactory(name: string): void;
};

const Store = () => {
  const idb = getIdb();

  return createStore<MatrixStoreData>()(
    persist(
      devtools(
        (set, get) => ({
          factories: [{
            id: "default-factory",
            name: "Default Factory",
            order: 0,
          }],
          selected: "default-factory",
          weights: {
            base: 1,
            products: new Map<ProductId, number>(),
            infrastructure: new Map<string, number>(),
          },
          lastSettingsTab: "weights",

          changeTab: (id: string) => {
            const settings = get();
            console.log("Changing tab to", id, settings);
            if (settings.factories.find(f => f.id === id)) {
              set({ selected: id });
            }
          },
          newFactory: (name: string) => {
            const settings = get();
            const newId = name.trim().toLowerCase().replace(/\s+/g, "-");
            if (settings.factories.some(f => f.id === newId)) {
              alert("Factory with this name already exists.");
              return;
            }
            set({
              factories: [...settings.factories, {
                id: newId,
                name: name.trim(),
                order: settings.factories.length
              }]
            });
          }
        })
      ),
      {
        name: "ProductionZone_settings",
        storage: {
          getItem: async (name) => {
            // const str = localStorage.getItem('ProductionZone_settings');
            if (!idb) return null;
            const str = await (await idb).get('current-state', name);

            if (!str) return null;
            return JSON.parse(str, hydration.reviver);
          },
          setItem: async (name, newValue: StorageValue<MatrixStoreData>) => {
            if (!idb) return;
            const str = JSON.stringify(newValue, hydration.replacer);

            return (await idb).put('current-state', str, name)
          },
          removeItem: (name) => localStorage.removeItem(name),

        },
        version: 2,
        migrate: (persistedState: unknown, currentVersion: number) => {
          if (!persistedState || !('factories' in (persistedState as MatrixStoreData))) {
            console.log("No persisted state found, or invalid, something is weird in migrate.");
            return persistedState as MatrixStoreData;
          }
          const newState = persistedState as MatrixStoreData;

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

  );
}

const isClient = typeof window !== "undefined";
const indexedDBVersion = 2;
const getIdb = () => {
  return isClient ? openDB("ProductionZoneStore", indexedDBVersion, {
    async upgrade(db, oldVersion) {
      if (oldVersion < 1) 
        return db.createObjectStore('current-state');
      else
        throw new Error("Database version not supported, please clear site data for this site.");
    }
  }) : null;
}
