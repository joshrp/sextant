import 'fake-indexeddb/auto';

import { describe, expect, test } from 'vitest';
import '@ungap/compression-stream/poly';
import * as imex from "./importexport";
import testFactories from "./testFactories.json";
import testExports from "./testExports.json";
import { default as FactoryStore, type GraphCoreData } from '../../context/store';
import { openDB } from 'idb';
import {setDebugSolver} from '../solver/solver';
import type { RecipeId, ProductId } from '../graph/loadJsonData';
import { DEFAULT_ZONE_MODIFIERS } from '~/context/zoneModifiers';

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
      const store = FactoryStore(idb, {id: "test", name: "Test Factory" }, () => DEFAULT_ZONE_MODIFIERS);
      
      await (store.Graph.getState().importData(data));

      expect(store.Graph.getState().solution?.ObjectiveValue).toBeCloseTo(10375.7, 1);
      const newExport = imex.minify(store.Graph.getState(), "zone-power-generation-steam");
      // Exported format should be V5 now (with node options support)
      expect(newExport[0]).toBe(5);
      
      // Verify round-trip: compress, decompress, unminify should preserve data
      const recompressed = await imex.compress(newExport);
      const redecompressed = await imex.decompress(recompressed);
      expect(redecompressed).toEqual(newExport);
      
    });

    test('parse version 5 with settlement options correctly set', async () => {
      setDebugSolver(false);

      const exportStr = testExports['version-5']['settlement-options'];
      const decompressed = await imex.decompress(exportStr) as imex.MinifiedStateV5;
      const data = imex.unminifyBulk(decompressed);
      const idb = getIdb();
      const store = FactoryStore(idb, {id: "test-settlement", name: "Test Settlement Factory" }, () => DEFAULT_ZONE_MODIFIERS);
      
      await (store.Graph.getState().importData(data.factories[0]));

      const settlementNode = store.Graph.getState().nodes.find(n => n.type === "recipe-node" && n.data.type === "settlement");
      expect(settlementNode).toBeDefined();
      if (settlementNode && settlementNode.type === "recipe-node" && settlementNode.data.type === "settlement") {
        expect(settlementNode.data.options).toBeDefined();
        expect(settlementNode.data.options!.inputs["Product_Water" as ProductId]).toBe(true);
        expect(settlementNode.data.options!.inputs["Product_Potato" as ProductId]).toBe(true);
        expect(settlementNode.data.options!.inputs["Product_Snack" as ProductId]).toBe(false);
        expect(settlementNode.data.options!.outputs["Product_WasteWater" as ProductId]).toBe(true);
      }
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

  describe('Annotation Node Export/Import', () => {
    test('round-trip preserves annotation nodes alongside recipe nodes', async () => {
      const testData: GraphCoreData = {
        name: "Mixed Nodes Factory",
        nodes: [
          {
            id: "r1",
            type: "recipe-node",
            position: { x: 100, y: 200 },
            data: { type: "recipe", recipeId: "PowerGeneratorT2" as RecipeId, ltr: true },
          },
          {
            id: "a1",
            type: "annotation-node",
            position: { x: 300, y: 400 },
            data: { text: "This is a **markdown** note" },
          },
        ],
        edges: [],
        goals: [],
      };

      const minified = imex.minify(testData, "test-zone");
      expect(minified[0]).toBe(5); // V5 format
      expect(minified[4]).toHaveLength(2);

      // Compress, decompress, unminify
      const compressed = await imex.compress(minified);
      const decompressed = await imex.decompress(compressed);
      const imported = imex.unminify(decompressed);

      expect(imported.nodes).toHaveLength(2);

      const recipeNode = imported.nodes.find(n => n.type === "recipe-node");
      expect(recipeNode).toBeDefined();
      expect(recipeNode!.id).toBe("r1");
      expect(recipeNode!.position).toEqual({ x: 100, y: 200 });

      const annotationNode = imported.nodes.find(n => n.type === "annotation-node");
      expect(annotationNode).toBeDefined();
      expect(annotationNode!.id).toBe("a1");
      expect(annotationNode!.position).toEqual({ x: 300, y: 400 });
      expect(annotationNode!.data).toEqual({ text: "This is a **markdown** note" });
    });

    test('annotation-only factory round-trips correctly', async () => {
      const testData: GraphCoreData = {
        name: "Notes Only",
        nodes: [
          {
            id: "n1",
            type: "annotation-node",
            position: { x: 0, y: 0 },
            data: { text: "First note" },
          },
        ],
        edges: [],
        goals: [],
      };

      const minified = imex.minify(testData, "zone");
      const compressed = await imex.compress(minified);
      const imported = imex.unminify(await imex.decompress(compressed));

      expect(imported.nodes).toHaveLength(1);
      expect(imported.nodes[0].type).toBe("annotation-node");
      expect(imported.nodes[0].data).toEqual({ text: "First note" });
    });
  });

  describe('Node Options Export/Import', () => {
    test('settlement node options round-trip', async () => {
      const testData: GraphCoreData = {
        name: "Settlement Options Test",
        nodes: [
          {
            id: "s1",
            type: "recipe-node",
            position: { x: 100, y: 200 },
            data: {
              type: "settlement",
              recipeId: "DesalinationFromDepleted" as RecipeId,
              ltr: true,
              options: {
                inputs: {
                  ["Product_Water" as ProductId]: true,
                  ["Product_Electricity" as ProductId]: false,
                },
                outputs: {
                  ["Product_Hydrogen" as ProductId]: false,
                },
              },
            },
          },
        ],
        edges: [],
        goals: [],
      };

      const minified = imex.minify(testData, "test-zone");
      expect(minified[0]).toBe(5);

      // The 8th element of the recipe node tuple should be the options
      const nodeTuple = minified[4][0];
      expect(nodeTuple).toHaveLength(8);

      // Compress, decompress, unminify
      const compressed = await imex.compress(minified);
      const decompressed = await imex.decompress(compressed);
      const imported = imex.unminify(decompressed);

      expect(imported.nodes).toHaveLength(1);
      const node = imported.nodes[0];
      expect(node.type).toBe("recipe-node");
      if (node.type === "recipe-node") {
        expect(node.data.type).toBe("settlement");
        expect(node.data.options).toBeDefined();
        expect(node.data.options!.inputs).toEqual({
          ["Product_Water"]: true,
          ["Product_Electricity"]: false,
        });
        expect(node.data.options!.outputs).toEqual({
          ["Product_Hydrogen"]: false,
        });
      }
    });

    test('recipe node useRecycling=false round-trip', async () => {
      const testData: GraphCoreData = {
        name: "Recipe Options Test",
        nodes: [
          {
            id: "r1",
            type: "recipe-node",
            position: { x: 0, y: 0 },
            data: {
              type: "recipe",
              recipeId: "PowerGeneratorT2" as RecipeId,
              ltr: true,
              options: { useRecycling: false },
            },
          },
        ],
        edges: [],
        goals: [],
      };

      const minified = imex.minify(testData, "zone");
      expect(minified[0]).toBe(5);

      // The 8th element should be an options object
      const nodeTuple = minified[4][0];
      expect(nodeTuple).toHaveLength(8);
      expect(nodeTuple[7]).toEqual({ r: false });

      const compressed = await imex.compress(minified);
      const imported = imex.unminify(await imex.decompress(compressed));

      expect(imported.nodes).toHaveLength(1);
      const node = imported.nodes[0];
      if (node.type === "recipe-node") {
        expect(node.data.options).toEqual({ useRecycling: false });
      }
    });

    test('recipe node without options has no 8th element', () => {
      const testData: GraphCoreData = {
        name: "No Options Test",
        nodes: [
          {
            id: "r1",
            type: "recipe-node",
            position: { x: 0, y: 0 },
            data: {
              type: "recipe",
              recipeId: "PowerGeneratorT2" as RecipeId,
              ltr: true,
            },
          },
        ],
        edges: [],
        goals: [],
      };

      const minified = imex.minify(testData, "zone");
      const nodeTuple = minified[4][0];
      expect(nodeTuple).toHaveLength(7); // No 8th element
    });

    test('balancer node has no options element', () => {
      const testData: GraphCoreData = {
        name: "Balancer Test",
        nodes: [
          {
            id: "b1",
            type: "recipe-node",
            position: { x: 0, y: 0 },
            data: {
              type: "balancer",
              recipeId: "DesalinationFromDepleted" as RecipeId,
              ltr: false,
            },
          },
        ],
        edges: [],
        goals: [],
      };

      const minified = imex.minify(testData, "zone");
      const nodeTuple = minified[4][0];
      expect(nodeTuple).toHaveLength(7); // No 8th element
    });

    test('mixed nodes with options: settlement + recipe + balancer + annotation', async () => {
      const testData: GraphCoreData = {
        name: "Mixed Options",
        nodes: [
          {
            id: "s1",
            type: "recipe-node",
            position: { x: 0, y: 0 },
            data: {
              type: "settlement",
              recipeId: "DesalinationFromDepleted" as RecipeId,
              ltr: true,
              options: {
                inputs: { ["Product_Water" as ProductId]: false },
                outputs: {},
              },
            },
          },
          {
            id: "r1",
            type: "recipe-node",
            position: { x: 100, y: 0 },
            data: {
              type: "recipe",
              recipeId: "PowerGeneratorT2" as RecipeId,
              ltr: true,
              options: { useRecycling: false },
            },
          },
          {
            id: "b1",
            type: "recipe-node",
            position: { x: 200, y: 0 },
            data: {
              type: "balancer",
              recipeId: "DesalinationFromDepleted" as RecipeId,
              ltr: false,
            },
          },
          {
            id: "a1",
            type: "annotation-node",
            position: { x: 300, y: 0 },
            data: { text: "A note" },
          },
        ],
        edges: [],
        goals: [],
      };

      const minified = imex.minify(testData, "zone");
      const compressed = await imex.compress(minified);
      const imported = imex.unminify(await imex.decompress(compressed));

      expect(imported.nodes).toHaveLength(4);

      // Settlement with options
      const settlement = imported.nodes[0];
      expect(settlement.type).toBe("recipe-node");
      if (settlement.type === "recipe-node") {
        expect(settlement.data.type).toBe("settlement");
        expect(settlement.data.options).toEqual({
          inputs: { Product_Water: false },
          outputs: {},
        });
      }

      // Recipe with useRecycling=false
      const recipe = imported.nodes[1];
      if (recipe.type === "recipe-node") {
        expect(recipe.data.type).toBe("recipe");
        expect(recipe.data.options).toEqual({ useRecycling: false });
      }

      // Balancer - no options
      const balancer = imported.nodes[2];
      if (balancer.type === "recipe-node") {
        expect(balancer.data.type).toBe("balancer");
        expect(balancer.data.options).toBeUndefined();
      }

      // Annotation
      const annotation = imported.nodes[3];
      expect(annotation.type).toBe("annotation-node");
      if (annotation.type === "annotation-node") {
        expect(annotation.data).toEqual({ text: "A note" });
      }
    });
  });

  describe('Bulk Export/Import', () => {
    test('minifyBulk creates bulk export data with factories', () => {
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

      expect(bulk.factories).toHaveLength(2);
      expect(bulk.factories[0][1]).toBe("Factory 1");
      expect(bulk.factories[0][2]).toBe("Zone A");
      expect(bulk.factories[0][3]).toBe("/icon1.png");
      expect(bulk.factories[1][1]).toBe("Factory 2");
      expect(bulk.factories[1][2]).toBe("Zone B");
      expect(bulk.factories[1][3]).toBe("");
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

    test('round-trip with zone modifiers: preserves modifiers through compress/decompress', async () => {
      const factory: GraphCoreData = { name: 'Modifier Test', nodes: [], edges: [], goals: [] };
      const customModifiers = { ...DEFAULT_ZONE_MODIFIERS, recyclingEfficiency: 0.75, farmYield: 1.5 };
      const bulk = imex.minifyBulk([{ state: factory, zoneName: 'Steel Zone' }], { 'Steel Zone': customModifiers });

      const compressed = await imex.compressBulk(bulk);

      const result = await imex.decompressBulk(compressed);
      expect(result.factories).toHaveLength(1);
      expect(result.zoneModifiers).toBeDefined();
      expect(result.zoneModifiers?.get('Steel Zone')).toEqual(customModifiers);
    });

    test('all-default modifiers: zones field omitted, zoneModifiers undefined after round-trip', async () => {
      const factory: GraphCoreData = { name: 'Default Mods', nodes: [], edges: [], goals: [] };
      const bulk = imex.minifyBulk([{ state: factory, zoneName: 'Zone A' }], { 'Zone A': DEFAULT_ZONE_MODIFIERS });

      // All-default: zones field should be absent from the export object
      expect(bulk.zones).toBeUndefined();

      const compressed = await imex.compressBulk(bulk);
      const result = await imex.decompressBulk(compressed);
      expect(result.zoneModifiers).toBeUndefined();
    });

    test('no modifiers: zoneModifiers is undefined after round-trip', async () => {
      const factory: GraphCoreData = { name: 'No Mods', nodes: [], edges: [], goals: [] };
      const bulk = imex.minifyBulk([{ state: factory, zoneName: 'Old Zone' }]);
      const compressed = await imex.compressBulk(bulk);

      const result = await imex.decompressBulk(compressed);
      expect(result.zoneModifiers).toBeUndefined();
    });

    test('export object without zones field: no modifiers applied', async () => {
      const factory: GraphCoreData = { name: 'No Zones Field', nodes: [], edges: [], goals: [] };
      // Manually construct an export object without a zones field
      const exportObj = { factories: imex.minifyBulk([{ state: factory, zoneName: 'Zone B' }]).factories };
      const raw = await imex.compress(exportObj);
      const result = imex.unminifyBulk(await imex.decompress(raw));

      expect(result.factories).toHaveLength(1);
      expect(result.zoneModifiers).toBeUndefined();
    });

    test('partial ZoneModifiers: missing keys filled from defaults', async () => {
      const factory: GraphCoreData = { name: 'Partial Mods', nodes: [], edges: [], goals: [] };

      // Manually build export object with partial modifiers (simulates future schema additions)
      const partialModifiers = { recyclingEfficiency: 0.60 }; // only one key
      const exportObj = {
        factories: imex.minifyBulk([{ state: factory, zoneName: 'Zone C' }]).factories,
        zones: { 'Zone C': { modifiers: partialModifiers as import('~/context/zoneModifiers').ZoneModifiers } },
      };
      const raw = await imex.compress(exportObj);
      const result = imex.unminifyBulk(await imex.decompress(raw));

      expect(result.zoneModifiers?.get('Zone C')?.recyclingEfficiency).toBe(0.60);
      // Missing keys should fall back to defaults
      expect(result.zoneModifiers?.get('Zone C')?.farmYield).toBe(DEFAULT_ZONE_MODIFIERS.farmYield);
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
