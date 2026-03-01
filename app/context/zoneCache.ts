import type { ProductionZoneStore } from "./ZoneStore";
import type { IDB } from "./idb";

type ZoneCacheEntry = { store: ProductionZoneStore, idb: IDB };

const storeCache: Record<string, ZoneCacheEntry> = {};

export function getCachedZoneStore(zoneId: string): ZoneCacheEntry | undefined {
  return storeCache[zoneId];
}

export function setCachedZoneStore(zoneId: string, store: ProductionZoneStore, idb: IDB) {
  storeCache[zoneId] = { store, idb };
}

export function clearCachedZoneStore(zoneId: string) {
  delete storeCache[zoneId];
}
