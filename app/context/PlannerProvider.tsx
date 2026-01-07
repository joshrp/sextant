import { openDB } from "idb";
import { useRef, type ReactNode } from "react";
import { createStore } from "zustand";

import { devtools, persist, type StorageValue } from "zustand/middleware";
import hydration from "~/hydration";
import { PlannerContext } from "./PlannerContext";
import { deleteIdb } from "./idb";
import { clearCachedZoneStore } from "./zoneCache";

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
    name: string,
    icon?: string,
    description?: string
  }[],
  lastSettingsTab: string,
  lastZone: string | undefined,
  sidebarWidth: number,
  newZone(name: string, icon?: string, description?: string): string;
  renameZone(id: string, newName: string): void;
  updateZone(id: string, updates: { name?: string; icon?: string; description?: string }): void;
  deleteZone(id: string): void;
  setLastZone(zoneId: string): void;
  setSidebarWidth(width: number): void;
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
          sidebarWidth: 240, // Default width in pixels

          newZone: (name: string, icon?: string, description?: string): string => {
            const settings = get();
            const newId = name.trim().toLowerCase().replace(/\s+/g, "-");
            if (settings.zones.some(z => z.id === newId))
              throw new Error("Zone with this name already exists");
            set({
              zones: [...settings.zones, {
                id: newId,
                name: name.trim(),
                order: settings.zones.length,
                icon,
                description
              }]
            });
            return newId;
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
          updateZone: (id: string, updates: { name?: string; icon?: string; description?: string }) => {
            const settings = get();
            const zone = settings.zones.find(z => z.id === id);
            if (!zone) throw new Error("Zone not found");
            if (updates.name !== undefined && updates.name !== zone.name) {
              if (settings.zones.some(z => z.name === updates.name && z.id !== id)) {
                throw new Error("Zone with this name already exists");
              }
              zone.name = updates.name;
            }
            if (updates.icon !== undefined) zone.icon = updates.icon;
            if (updates.description !== undefined) zone.description = updates.description;
            set({
              zones: [...settings.zones]
            });
          },
          deleteZone: async (id: string) => {
            const settings = get();
            const zone = settings.zones.find(z => z.id === id);
            if (!zone) throw new Error("Zone not found");
            
            const filteredZones = settings.zones.filter(z => z.id !== id);
            await deleteIdb(id);
            clearCachedZoneStore(id);
            set({
              zones: filteredZones,
              // Clear lastZone if it was the deleted zone
              lastZone: settings.lastZone === id ? undefined : settings.lastZone,
            });
          },
          setLastZone: (zoneId: string) => {
            set({ lastZone: zoneId });
          },
          setSidebarWidth: (width: number) => {
            set({ sidebarWidth: width });
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
          removeItem: async (name) => {
            if (!idb) return Promise.resolve();
            return (await idb).delete(mainObjectStore, name);
          }
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
