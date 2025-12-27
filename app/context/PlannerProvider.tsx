import { openDB } from "idb";
import { useRef, type ReactNode } from "react";
import { createStore } from "zustand";

import { devtools, persist, type StorageValue } from "zustand/middleware";
import hydration from "~/hydration";
import { PlannerContext } from "./PlannerContext";

export const PlannerProvider = ({ children }: { children: ReactNode }) => {
  const storeRef = useRef<PlannerStore | null>(null);

  if (!storeRef.current) {
    // Initialize store only once
    storeRef.current = Store();
  }
  return (
    <PlannerContext.Provider value={{ store: storeRef.current }}>
      {children}
    </PlannerContext.Provider>
  );
};

export type PlannerStore = ReturnType<typeof Store>;
export interface PlannerStoreData {
  zones: {
    id: string,
    order: number,
    name: string
  }[],
  lastSettingsTab: string,
  lastZone: string | undefined,
  newZone(name: string): void;
  renameZone(id: string, newName: string): void;
  setLastZone(zoneId: string): void;
};

const Store = () => {
  const idb = getIdb();

  return createStore<PlannerStoreData>()(
    persist(
      devtools(
        (set, get) => ({
          zones: [{
            id: "main",
            name: "Default",
            order: 0,
          }],
          lastSettingsTab: "weights",
          lastZone: undefined,

          newZone: (name: string) => {
            const settings = get();
            const newId = name.trim().toLowerCase().replace(/\s+/g, "-");
            if (settings.zones.some(z => z.id === newId))
              throw new Error("Zone with this name already exists");
            set({
              zones: [...settings.zones, {
                id: newId,
                name: name.trim(),
                order: settings.zones.length
              }]
            });
          },
          renameZone: (id: string, newName: string) => {
            const settings = get();
            const zone = settings.zones.find(z => z.id === id);
            if (!zone) throw new Error("Zone not found");
            if (settings.zones.some(z => z.name === newName && z.id !== id))
              throw new Error("Zone with this name already exists");
            zone.name = newName;
            set({
              zones: [...settings.zones]
            });
          },
          setLastZone: (zoneId: string) => {
            set({ lastZone: zoneId });
          }
        })
      ),
      {
        name: "Store",
        storage: {
          getItem: async (name) => {
            // const str = localStorage.getItem('Planner_settings');
            if (!idb) return null;
            const str = await (await idb).get(mainObjectStore, name);

            if (!str) return null;
            return JSON.parse(str, hydration.reviver);
          },
          setItem: async (name, newValue: StorageValue<PlannerStoreData>) => {
            if (!idb) return;
            const str = JSON.stringify(newValue, hydration.replacer);

            return (await idb).put(mainObjectStore, str, name)
          },
          removeItem: (name) => localStorage.removeItem(name),
        },
        version: 2,
        migrate: (persistedState: unknown) => {//, currentVersion: number) => {
          if (!persistedState || !('zones' in (persistedState as PlannerStoreData))) {
            console.error("No persisted state found, or invalid, something is weird in migrate.");
            return persistedState as PlannerStoreData;
          }
          const newState = persistedState as PlannerStoreData;          

          return newState;
        }
      })

  );
}

const mainObjectStore = 'settings';
const isClient = typeof window !== "undefined";
const indexedDBVersion = 1;
const getIdb = () => {
  return isClient ? openDB("COI_Planner", indexedDBVersion, {
    async upgrade(db, oldVersion) {
      if (oldVersion < 1) 
        return db.createObjectStore(mainObjectStore);
      else
        throw new Error("Database version not supported, please clear site data for this site.");
    }
  }) : null;
}
