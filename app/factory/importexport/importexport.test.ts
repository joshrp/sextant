import 'fake-indexeddb/auto';

import { describe, expect, test } from 'vitest';
import '@ungap/compression-stream/poly';
import * as imex from "./importexport";
import testFactories from "./testFactories.json";
import testExports from "./testExports.json";
import { default as FactoryStore, type GraphCoreData } from '../store';
import { openDB } from 'idb';
import {setDebugSolver} from '../solver/solver';

describe("Import Export", () => {
  describe.each(Object.entries(testFactories))('Exporting %s', (key, data) => {
    test(`Basic export`, async () => {
      const str = imex.getBasicB64(data);
      expect(str).toMatchSnapshot();
    });
    test('Minify', async () => {
      const min = imex.minify(data as GraphCoreData, "zone");
      expect(min).toMatchSnapshot();
    });
    test('Minify and compress, decompress', async () => {
      const min = imex.minify(data as GraphCoreData, "zone");
      const compressed = await imex.compress(min);
      expect(compressed).toMatchSnapshot();
      const decompressed = await imex.decompress(compressed);
      expect(decompressed).toEqual(min);
    });
  });

  describe.each(Object.entries(testExports['version-1']))('Importing %s', (key, data) => {
    test('Decompress and unminify', async () => {
      if (typeof data !== "string") throw new Error("Test data is not a string");
      const decompressed = await imex.decompress(data);
      expect(decompressed).toMatchSnapshot();
      const core = imex.unminify(decompressed);
      expect(core).toMatchSnapshot();
    });
  });

  describe('Full Store Export/Import', () => {
    test('Compress and decompress full store', async () => {

      setDebugSolver(false);
      const exportStr = testExports['version-1']['steam-large'];
      const min = await imex.decompress(exportStr) as imex.MinifiedStateV1;
      const data = imex.unminify(min);
      const idb = getIdb();
      const store = FactoryStore(idb, {id: "test", name: "Test Factory" });
      
      await (store.Graph.getState().importData(data));

      expect(store.Graph.getState().solution?.ObjectiveValue).toBeCloseTo(10375.7, 1);
      const newExport = imex.minify(store.Graph.getState(), "zone-power-generation-steam");
      // Exported format should be V3 now (with node data type field)
      expect(newExport[0]).toBe(3);
      
      // Verify round-trip: compress, decompress, unminify should preserve data
      const recompressed = await imex.compress(newExport);
      const redecompressed = await imex.decompress(recompressed);
      expect(redecompressed).toEqual(newExport);
      
    });

  });

  describe('Icon Export/Import', () => {
    test('Export with icon and import preserves it', async () => {
      const testIcon = '/assets/products/Product_Iron.png';
      const testData: GraphCoreData = {
        name: "Test Factory with Icon",
        nodes: [],
        edges: [],
        goals: []
      };
      
      // Export with icon
      const minified = imex.minify(testData, "zone", testIcon);
      expect(minified[3]).toBe(testIcon);
      
      // Compress and decompress
      const compressed = await imex.compress(minified);
      const decompressed = await imex.decompress(compressed);
      
      // Import and verify icon is preserved
      const imported = imex.unminify(decompressed);
      expect(imported.icon).toBe(testIcon);
      expect(imported.name).toBe("Test Factory with Icon");
    });

    test('Export without icon works correctly', async () => {
      const testData: GraphCoreData = {
        name: "Test Factory without Icon",
        nodes: [],
        edges: [],
        goals: []
      };
      
      // Export without icon
      const minified = imex.minify(testData, "zone");
      expect(minified[3]).toBe("");
      
      // Compress and decompress
      const compressed = await imex.compress(minified);
      const decompressed = await imex.decompress(compressed);
      
      // Import and verify icon is undefined
      const imported = imex.unminify(decompressed);
      expect(imported.icon).toBe("");
      expect(imported.name).toBe("Test Factory without Icon");
    });
  });

  describe('Bulk Export/Import', () => {
    test('minifyBulk creates array of minified factories', () => {
      const factory1: GraphCoreData = {
        name: "Factory 1",
        nodes: [],
        edges: [],
        goals: []
      };
      const factory2: GraphCoreData = {
        name: "Factory 2",
        nodes: [],
        edges: [],
        goals: []
      };

      const bulk = imex.minifyBulk([
        { state: factory1, zoneName: "Zone A", icon: "/icon1.png" },
        { state: factory2, zoneName: "Zone B" }
      ]);

      expect(bulk).toHaveLength(2);
      expect(bulk[0][1]).toBe("Factory 1");
      expect(bulk[0][2]).toBe("Zone A");
      expect(bulk[0][3]).toBe("/icon1.png");
      expect(bulk[1][1]).toBe("Factory 2");
      expect(bulk[1][2]).toBe("Zone B");
      expect(bulk[1][3]).toBe("");
    });

    test('unminifyBulk handles single factory (backward compatible)', () => {
      const factory: GraphCoreData = {
        name: "Single Factory",
        nodes: [],
        edges: [],
        goals: []
      };
      
      const minified = imex.minify(factory, "Zone Single");
      const bulk = imex.unminifyBulk(minified);

      expect(bulk.factories).toHaveLength(1);
      expect(bulk.factories[0].name).toBe("Single Factory");
      expect(bulk.factories[0].zoneName).toBe("Zone Single");
      expect(bulk.isSingleZone).toBe(true);
      expect(bulk.zoneGroups.size).toBe(1);
      expect(bulk.zoneGroups.get("Zone Single")).toEqual([0]);
    });

    test('unminifyBulk handles multiple factories in same zone', () => {
      const factory1: GraphCoreData = {
        name: "Factory 1",
        nodes: [],
        edges: [],
        goals: []
      };
      const factory2: GraphCoreData = {
        name: "Factory 2",
        nodes: [],
        edges: [],
        goals: []
      };

      const bulk = imex.minifyBulk([
        { state: factory1, zoneName: "Same Zone" },
        { state: factory2, zoneName: "Same Zone" }
      ]);

      const result = imex.unminifyBulk(bulk);

      expect(result.factories).toHaveLength(2);
      expect(result.isSingleZone).toBe(true);
      expect(result.zoneGroups.size).toBe(1);
      expect(result.zoneGroups.get("Same Zone")).toEqual([0, 1]);
    });

    test('unminifyBulk handles multiple factories in different zones', () => {
      const factory1: GraphCoreData = {
        name: "Factory A1",
        nodes: [],
        edges: [],
        goals: []
      };
      const factory2: GraphCoreData = {
        name: "Factory B1",
        nodes: [],
        edges: [],
        goals: []
      };
      const factory3: GraphCoreData = {
        name: "Factory A2",
        nodes: [],
        edges: [],
        goals: []
      };

      const bulk = imex.minifyBulk([
        { state: factory1, zoneName: "Zone A" },
        { state: factory2, zoneName: "Zone B" },
        { state: factory3, zoneName: "Zone A" }
      ]);

      const result = imex.unminifyBulk(bulk);

      expect(result.factories).toHaveLength(3);
      expect(result.isSingleZone).toBe(false);
      expect(result.zoneGroups.size).toBe(2);
      expect(result.zoneGroups.get("Zone A")).toEqual([0, 2]);
      expect(result.zoneGroups.get("Zone B")).toEqual([1]);
    });

    test('compressBulk and decompressBulk roundtrip', async () => {
      const factory1: GraphCoreData = {
        name: "Factory X",
        nodes: [],
        edges: [],
        goals: []
      };
      const factory2: GraphCoreData = {
        name: "Factory Y",
        nodes: [],
        edges: [],
        goals: []
      };

      const bulk = imex.minifyBulk([
        { state: factory1, zoneName: "Zone X", icon: "/iconX.png" },
        { state: factory2, zoneName: "Zone Y" }
      ]);

      const compressed = await imex.compressBulk(bulk);
      expect(typeof compressed).toBe('string');

      const decompressed = await imex.decompressBulk(compressed);
      expect(decompressed.factories).toHaveLength(2);
      expect(decompressed.factories[0].name).toBe("Factory X");
      expect(decompressed.factories[0].zoneName).toBe("Zone X");
      expect(decompressed.factories[0].icon).toBe("/iconX.png");
      expect(decompressed.factories[1].name).toBe("Factory Y");
      expect(decompressed.factories[1].zoneName).toBe("Zone Y");
    });

    test('getFactoryMetadataFromMinified extracts metadata', () => {
      const factory: GraphCoreData = {
        name: "Metadata Test Factory",
        nodes: [],
        edges: [],
        goals: []
      };

      const minified = imex.minify(factory, "Test Zone", "/test-icon.png");
      const metadata = imex.getFactoryMetadataFromMinified(minified);

      expect(metadata.name).toBe("Metadata Test Factory");
      expect(metadata.zoneName).toBe("Test Zone");
      expect(metadata.icon).toBe("/test-icon.png");
      expect(metadata.nodeCount).toBe(0);
      expect(metadata.edgeCount).toBe(0);
      expect(metadata.goalCount).toBe(0);
    });

    test('backward compatibility: decompressBulk handles existing single factory export', async () => {
      // Use an existing export (it's actually v2 format with zone name)
      const exportStr = testExports['version-1']['steam-large'];
      
      const result = await imex.decompressBulk(exportStr);
      
      expect(result.factories).toHaveLength(1);
      expect(result.isSingleZone).toBe(true);
      // The steam-large export has a zone name already (it's v2 format despite being in version-1 folder)
      expect(result.factories[0].zoneName).toBe("zone-power-generation-steam");
    });
  });
});

const getIdb = () => {
  return openDB("TestFake_ImportExport", 1, {
    async upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        await db.createObjectStore("factories");
        await db.createObjectStore("factory-history");
      }
      else
        throw new Error("Database version not supported, please clear site data for this site.");
    }
  });
}
