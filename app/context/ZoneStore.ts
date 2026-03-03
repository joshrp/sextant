import { createStore } from "zustand";
import { devtools, persist, subscribeWithSelector, type StorageValue } from "zustand/middleware";
import hydration from "~/hydration";
import type { ProductId } from "../factory/graph/loadJsonData";
import { zoneObjectStore, type IDB } from "./idb";
import { factoryIdFromName } from "./utils";
import { DEFAULT_ZONE_MODIFIERS, type ZoneModifiers } from "./zoneModifiers";

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
  modifiers: ZoneModifiers;
  setModifier(key: keyof ZoneModifiers, value: number): void;
  resetModifiers(): void;
  setProductDisplayMode: (mode: "icons" | "names") => void;
  newFactory(name: string, id?: string, icon?: string, description?: string): string;
  setLastFactory(id: string): void;
  renameFactory(id: string, newName: string): void;
  updateFactory(id: string, updates: { name?: string; icon?: string; description?: string }): void;
  removeFactory(id: string): void;
}

export type ProductionZoneStore = ReturnType<typeof buildZoneStore>;

export function createZoneStore(idb: IDB, { id, name }: { id: string, name: string }): ProductionZoneStore {
  return buildZoneStore(idb, { id, name });
}

function buildZoneStore(idb: IDB, { id, name }: { id: string, name: string }) {
  return createStore<ProductionZoneStoreData>()(
    subscribeWithSelector(
      persist(
        devtools(
          (set, get) => ({
            id, name,
            factories: [],

            weights: {
              base: 1,
              products: new Map<ProductId, number>(),
              infrastructure: new Map<string, number>(),
            },
            lastFactory: undefined,
            productDisplayMode: "icons",
            modifiers: DEFAULT_ZONE_MODIFIERS,
            setModifier: (key, value) => set(s => ({ modifiers: { ...s.modifiers, [key]: value } })),
            resetModifiers: () => set({ modifiers: DEFAULT_ZONE_MODIFIERS }),
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
              if (!idb) return null;
              const str = await (await idb).get(zoneObjectStore, name);
              if (!str) return null;
              return JSON.parse(str, hydration.reviver);
            },
            setItem: async (name, newValue: StorageValue<ProductionZoneStoreData>) => {
              if (!idb) return;
              const str = JSON.stringify(newValue, hydration.replacer);
              return (await idb).put(zoneObjectStore, str, name);
            },
            removeItem: async (name) => {
              if (!idb) return;
              return (await idb).delete(zoneObjectStore, name);
            }
          },
          version: 3,
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

            if (currentVersion <= 2) {
              newState.modifiers = DEFAULT_ZONE_MODIFIERS;
              console.log("Migrated ProductionZone_settings to version 3: added modifiers", newState);
            }

            return newState;
          }
        })
    )
  );
}
