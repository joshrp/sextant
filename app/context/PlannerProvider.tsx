import { openDB } from "idb";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createStore } from "zustand";

import { devtools, persist, type StorageValue } from "zustand/middleware";
import { setDebugSolver } from "~/factory/solver/solver";
import FactoryStore from "~/context/store";
import hydration from "~/hydration";
import type { ExportableFactory, ExportableZone } from "~/types/bulkOperations";
import { PlannerContext, type BulkImportItem } from "./PlannerContext";
import type { ProductionZoneStore, ProductionZoneStoreData } from "./ZoneStore";
import { createZoneStore } from "./ZoneStore";
import { deleteIdb, getIdb as getZoneIdb, zoneObjectStore } from "./idb";
import { factoryIdFromName } from "./utils";
import { clearCachedZoneStore, getCachedZoneStore, setCachedZoneStore } from "./zoneCache";
import { DEFAULT_ZONE_MODIFIERS } from "./zoneModifiers";
import { loadTemplateFactory } from "~/onboarding/templateFactory";

export const PlannerProvider = ({ children }: { children: ReactNode }) => {
  const storeRef = useRef<PlannerStore | null>(null);

  if (!storeRef.current) {
    // Initialize store only once
    storeRef.current = Store();
  }

  /**
   * Bulk import factories across zones
   * Creates new zones as needed and imports factories into their target zones
   */
  const bulkImport = useCallback(async (items: BulkImportItem[]) => {
    if (!storeRef.current) throw new Error("Planner store not initialized");
    const store = storeRef.current;

    // Group items by target zone
    const itemsByZone = new Map<string, BulkImportItem[]>();
    const newZones = new Map<string, string>(); // newZoneName -> generated zoneId

    for (const item of items) {
      if (item.newZoneName) {
        // Need to create a new zone
        if (!newZones.has(item.newZoneName)) {
          // Create the zone and cache the ID
          const newZoneId = store.getState().newZone(item.newZoneName);
          newZones.set(item.newZoneName, newZoneId);
        }
        const zoneId = newZones.get(item.newZoneName)!;
        const existing = itemsByZone.get(zoneId) || [];
        existing.push({ ...item, targetZoneId: zoneId });
        itemsByZone.set(zoneId, existing);
      } else {
        // Use existing zone
        const existing = itemsByZone.get(item.targetZoneId) || [];
        existing.push(item);
        itemsByZone.set(item.targetZoneId, existing);
      }
    }

    // Import factories into each zone (without solving), collecting stores for the solve pass
    const importedFactoryStores: ReturnType<typeof FactoryStore>[] = [];

    for (const [zoneId, zoneItems] of itemsByZone) {
      // Get or create the zone IDB
      const zoneIdb = getZoneIdb(zoneId);
      if (!zoneIdb) throw new Error("Failed to get IDB for zone: " + zoneId);

      // Check if we have a cached zone store
      let zoneStore = getCachedZoneStore(zoneId)?.store;
      
      // If not cached, we need to create a zone store and wait for hydration
      if (!zoneStore) {
        // We need to create a new zone store
        const zone = store.getState().zones.find(z => z.id === zoneId);
        if (!zone) throw new Error("Zone not found: " + zoneId);
        
        // Create and await hydration of the zone store
        zoneStore = await createZoneStoreAsync(zoneIdb, zoneId, zone.name);
        setCachedZoneStore(zoneId, zoneStore, zoneIdb);
      }

      // Apply zone modifiers from import envelope if any item carries them.
      // All items for the same zone share the same modifiers, so check the first one found.
      const modifiersToApply = zoneItems.find(i => i.importModifiers)?.importModifiers;
      if (modifiersToApply) {
        zoneStore.setState(s => ({ ...s, modifiers: modifiersToApply }));
        await waitForStorePersist();
      }

      // Import each factory into the zone without solving
      for (const item of zoneItems) {
        const factoryName = item.data.name;
        // Use factoryIdFromName to get base ID
        const baseFactoryId = factoryIdFromName(factoryName);

        // Add factory to zone's factory list first - this handles ID collision and returns actual ID
        const actualFactoryId = zoneStore.getState().newFactory(factoryName, baseFactoryId, item.data.icon || undefined);

        const getZoneModifiers = () => zoneStore?.getState().modifiers ?? DEFAULT_ZONE_MODIFIERS;

        // Create the factory store with the actual ID and import data without running solver
        const factoryStore = FactoryStore(zoneIdb, { id: actualFactoryId, name: factoryName }, getZoneModifiers);
        await factoryStore.Graph.getState().importData(item.data, { skipSolver: true });
        importedFactoryStores.push(factoryStore);
        
        // Wait for factory store to persist to IDB
        await waitForStorePersist();
      }
      
      // Wait for zone store to persist after all factories are added
      await waitForStorePersist();
    }

    // All factories are now persisted — run solves
    for (const factoryStore of importedFactoryStores) {
      await factoryStore.Graph.getState().graphUpdateAction();
      await waitForStorePersist();
    }
  }, []);

  /**
   * Get all zones and their factories for bulk export
   */
  const getExportableData = useCallback(async (): Promise<ExportableZone[]> => {
    if (!storeRef.current) return [];
    const store = storeRef.current;
    
    const zones = store.getState().zones;
    const exportableZones: ExportableZone[] = [];

    for (const zone of zones) {
      const zoneIdb = getZoneIdb(zone.id);
      if (!zoneIdb) continue;

      // Try to get cached zone store or read from IDB
      let factories: ProductionZoneStoreData['factories'] = [];
      const cached = getCachedZoneStore(zone.id);
      
      if (cached?.store) {
        factories = cached.store.getState().factories;
      } else {
        // Read factory list from IDB directly
        try {
          const db = await zoneIdb;
          const zoneData = await db.get(zoneObjectStore, 'current-state');
          if (zoneData) {
            const parsed = JSON.parse(zoneData, hydration.reviver);
            factories = parsed.state?.factories || [];
          }
        } catch (err) {
          console.warn("Failed to read zone data for export:", zone.id, err);
          continue;
        }
      }

      // Read zone modifiers (from cache or IDB)
      let zoneModifiers = cached?.store?.getState().modifiers ?? null;
      if (!zoneModifiers) {
        try {
          const db = await zoneIdb;
          const zoneData = await db.get(zoneObjectStore, 'current-state');
          if (zoneData) {
            const parsed = JSON.parse(zoneData, hydration.reviver);
            zoneModifiers = parsed.state?.modifiers ?? null;
          }
        } catch {
          // Non-fatal: modifiers just won't be included for this zone
        }
      }

      // Get factory data for each factory
      const exportableFactories: ExportableFactory[] = [];
      
      for (const factory of factories) {
        try {
          const db = await zoneIdb;
          const factoryData = await db.get('factories', factory.id);
          
          if (factoryData) {
            const parsed = JSON.parse(factoryData, hydration.reviver);
            const state = parsed.state || parsed;
            
            exportableFactories.push({
              id: factory.id,
              zoneId: zone.id,
              zoneName: zone.name,
              zoneIcon: zone.icon,
              name: factory.name || state.name,
              icon: factory.icon,
              nodeCount: state.nodes?.length || 0,
              edgeCount: state.edges?.length || 0,
              goalCount: state.goals?.length || 0,
              data: {
                name: factory.name || state.name,
                nodes: state.nodes || [],
                edges: state.edges || [],
                goals: state.goals || [],
              },
            });
          }
        } catch (err) {
          console.warn("Failed to read factory data for export:", factory.id, err);
        }
      }

      exportableZones.push({
        id: zone.id,
        name: zone.name,
        icon: zone.icon,
        factories: exportableFactories,
        modifiers: zoneModifiers ?? undefined,
      });
    }

    return exportableZones;
  }, []);

  const importWelcomeFactory = useCallback(async () => {
    const store = storeRef.current!;
    try {
      const templateData = await loadTemplateFactory();
      const items: BulkImportItem[] = [
        // All template factories go into the default zone
        ...templateData.factories.map(f => ({
          data: f,
          targetZoneId: "main",
        })),
        // Empty factory for the user to work in
        {
          data: { name: "My Factory", zoneName: "", icon: "", nodes: [], edges: [], goals: [] },
          targetZoneId: "main",
        },
      ];
      await bulkImport(items);
    } catch (err) {
      console.warn("Failed to load template factory:", err);
    } finally {
      store.getState().setHasCompletedFirstVisit(true);
    }
  }, [bulkImport]);

  // First-visit: load template factory once for new users
  useEffect(() => {
    const store = storeRef.current!;

    const check = (state: PlannerStoreData) => {
      if (!state.hasCompletedFirstVisit) {
        importWelcomeFactory();
      }
    };

    if (store.persist.hasHydrated()) {
      check(store.getState());
    } else {
      const unsub = store.persist.onFinishHydration((state) => {
        unsub();
        check(state);
      });
    }
  }, [importWelcomeFactory]);

  return (
    <PlannerContext.Provider value={{ 
      store: storeRef.current,
      bulkImport,
      getExportableData,
      importWelcomeFactory,
    }}>
      {children}
    </PlannerContext.Provider>
  );
};

/**
 * Wait for a zustand store with persist middleware to finish persisting
 * This is needed to ensure data is written to IDB before continuing.
 * 
 * Note: Zustand's persist middleware doesn't expose a "persisted" event,
 * so we use a small delay to allow the async IDB writes to complete.
 * The middleware calls setItem() when state changes, which returns a Promise,
 * but that Promise isn't awaited by zustand internally.
 */
async function waitForStorePersist(): Promise<void> {
  // Small delay to allow persist middleware to write to storage
  // The persist middleware batches writes, so we need to give it time
  // TODO:: There may be a better way to do this with store promises
  return new Promise(resolve => setTimeout(resolve, 100));
}

/**
 * Create a real zone store for import operations and wait for hydration.
 * Uses the same Store factory as ProductionZoneProvider to ensure version
 * compatibility and correct migration of persisted data.
 */
async function createZoneStoreAsync(
  idb: ReturnType<typeof getZoneIdb>,
  zoneId: string,
  zoneName: string
): Promise<ProductionZoneStore> {
  if (!idb) throw new Error("IDB is null for zone: " + zoneId);
  const store = createZoneStore(idb, { id: zoneId, name: zoneName });

  return new Promise((resolve) => {
    // If hydration already completed synchronously, resolve immediately
    if (store.persist.hasHydrated()) {
      resolve(store);
      return;
    }
    store.persist.onFinishHydration(() => resolve(store));
  });
}

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
  debugSolver: boolean,
  /** True once the first-visit template factory has been loaded. Persisted in IndexedDB. */
  hasCompletedFirstVisit: boolean,
  newZone(name: string, icon?: string, description?: string): string;
  renameZone(id: string, newName: string): void;
  updateZone(id: string, updates: { name?: string; icon?: string; description?: string }): void;
  deleteZone(id: string): void;
  setLastZone(zoneId: string): void;
  setSidebarWidth(width: number): void;
  setDebugSolver(enabled: boolean): void;
  setHasCompletedFirstVisit(value: boolean): void;
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
          debugSolver: false,
          lastZone: undefined,
          sidebarWidth: 240, // Default width in pixels
          hasCompletedFirstVisit: false,

          newZone: (name: string, icon?: string, description?: string): string => {
            const settings = get();
            // Generate URL-safe zone ID (strip all non-alphanumeric characters)
            const newId = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
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
          },
          setDebugSolver: (enabled: boolean) => {
            set({ debugSolver: enabled });
            // Sync to solver
            setDebugSolver(enabled);
          },
          setHasCompletedFirstVisit: (value: boolean) => {
            set({ hasCompletedFirstVisit: value });
          },
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
        version: 3,
        migrate: (persistedState: unknown, fromVersion: number) => {
          if (!persistedState || !('zones' in (persistedState as PlannerStoreData))) {
            console.error("No persisted state found, or invalid, something is weird in migrate.");
            return persistedState as PlannerStoreData;
          }
          const newState = persistedState as PlannerStoreData;

          // v2 -> v3: existing users already have factories; skip the first-visit template load
          if (fromVersion < 3) {
            newState.hasCompletedFirstVisit = true;
          }

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
