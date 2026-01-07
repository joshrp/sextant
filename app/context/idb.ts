import { openDB } from "idb";

export type IDB = ReturnType<typeof openDB>;
const isClient = typeof window !== "undefined";
const isTests = typeof process !== "undefined" && process.env.NODE_ENV === "test";
const indexedDBVersion = 3;
export const zoneObjectStore = 'zone-settings';
export const factoryArchiveStore = 'factory-archive';

/**
 * Note, do not use outside this module
 * Exported for testing only
 * @param zoneId 
 * @returns 
 */
export const getIdb = (zoneId: string) => {
  return isClient || isTests ? openDB("Zone_" + zoneId, indexedDBVersion, {
    async upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore(zoneObjectStore);
        db.createObjectStore("factories");
        db.createObjectStore("factory-history");
      }
      if (oldVersion < 3) {
        db.createObjectStore(factoryArchiveStore);
      }
    }
  }) : null;
}

export const deleteIdb = (zoneId: string) => {
  if (isClient || isTests) {
    return indexedDB.deleteDatabase("Zone_" + zoneId);
  }
}
