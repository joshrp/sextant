import { compress, decompress, minify, unminify } from "~/factory/importexport/importexport";
import type { GraphCoreData, GraphImportData } from "~/context/store";
import { factoryArchiveStore, type IDB } from "./idb";

/**
 * Metadata about an archived factory for display purposes
 */
export interface ArchivedFactoryMetadata {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  archivedAt: number;
  nodeCount: number;
  edgeCount: number;
  goalCount: number;
}

/**
 * Full archived factory data stored in IndexedDB
 */
export interface ArchivedFactory extends ArchivedFactoryMetadata {
  compressedData: string;
}

/**
 * Archive a factory by minifying and compressing its data
 */
export async function archiveFactory(
  idb: IDB,
  factoryData: GraphCoreData,
  zoneName: string,
  metadata: {
    id: string;
    icon?: string;
    description?: string;
  }
): Promise<ArchivedFactoryMetadata> {
  const minified = minify(factoryData, zoneName, metadata.icon);
  const compressed = await compress(minified);

  const archived: ArchivedFactory = {
    id: metadata.id,
    name: factoryData.name,
    icon: metadata.icon,
    description: metadata.description,
    archivedAt: Date.now(),
    nodeCount: factoryData.nodes.length,
    edgeCount: factoryData.edges.length,
    goalCount: factoryData.goals.length,
    compressedData: compressed,
  };

  const db = await idb;
  await db.put(factoryArchiveStore, JSON.stringify(archived), archived.id);

  return {
    id: archived.id,
    name: archived.name,
    icon: archived.icon,
    description: archived.description,
    archivedAt: archived.archivedAt,
    nodeCount: archived.nodeCount,
    edgeCount: archived.edgeCount,
    goalCount: archived.goalCount,
  };
}

/**
 * List all archived factories (metadata only)
 */
export async function listArchivedFactories(idb: IDB): Promise<ArchivedFactoryMetadata[]> {
  const db = await idb;
  const keys = await db.getAllKeys(factoryArchiveStore);
  const archives: ArchivedFactoryMetadata[] = [];

  for (const key of keys) {
    const data = await db.get(factoryArchiveStore, key);
    if (data) {
      const parsed: ArchivedFactory = JSON.parse(data);
      archives.push({
        id: parsed.id,
        name: parsed.name,
        icon: parsed.icon,
        description: parsed.description,
        archivedAt: parsed.archivedAt,
        nodeCount: parsed.nodeCount,
        edgeCount: parsed.edgeCount,
        goalCount: parsed.goalCount,
      });
    }
  }

  // Sort by archived date, newest first
  return archives.sort((a, b) => b.archivedAt - a.archivedAt);
}

/**
 * Restore a factory from archive and return its import data
 */
export async function restoreArchivedFactory(
  idb: IDB,
  archiveId: string
): Promise<GraphImportData> {
  const db = await idb;
  const data = await db.get(factoryArchiveStore, archiveId);

  if (!data) {
    throw new Error(`Archive not found: ${archiveId}`);
  }

  const archived: ArchivedFactory = JSON.parse(data);
  const decompressed = await decompress(archived.compressedData);
  return unminify(decompressed);
}

/**
 * Delete a factory from the archive permanently
 */
export async function deleteArchivedFactory(idb: IDB, archiveId: string): Promise<void> {
  const db = await idb;
  await db.delete(factoryArchiveStore, archiveId);
}
