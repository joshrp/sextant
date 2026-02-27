import { loadData, type ProductId, type RecipeId } from "../graph/loadJsonData";
import { isRecipeNode, isAnnotationNode } from "../graph/nodeTypes";
import type { GraphCoreData, GraphImportData, GraphImportRecipeNode } from "../store";
import { getRecipeInputs, getRecipeOutputs } from "~/gameData/utils";

import hydration from "~/hydration";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getBasicB64 = (state: any) => {
  return btoa(JSON.stringify(state, hydration.replacer));
}
const { recipes } = loadData();

/**
 * Metadata for a factory in bulk export/import operations
 */
export interface FactoryExportMetadata {
  id: string;
  name: string;
  zoneName: string;
  zoneId: string;
  icon?: string;
  nodeCount: number;
  edgeCount: number;
  goalCount: number;
}
const NodeTypes = {
  "recipe-node": "n",
  "annotation-node": "a",
  get: function (id?: string) { return this[(id ?? "recipe-node") as keyof typeof NodeTypes] },
  find: function (val: string): string | undefined { return Object.entries(this).find(([, v]) => v === val)?.[0] }
}
const EdgeTypes = {
  "button-edge": "b",
  get: function (id?: string) { return this[(id ?? "button-edge") as keyof typeof EdgeTypes] },
  find: function (val: string): string | undefined { return Object.entries(this).find(([, v]) => v === val)?.[0] }
}

export type MinifiedStateV2 = [
  number, // version
  string, // name
  string, // zone
  string, // icon (optional)
  [ // nodes
    string, // type
    string, // id
    number, // x
    number, // y
    string, // recipeId
    boolean, // ltr,
  ][],
  [ // edges
    string, // type
    string, // productId
    string, // source
    string, // target
  ][],
  [ // goals
    string, // productId
    number, // qty
    "eq" | "lt" | "gt", // type
    boolean, // isOutput
  ][],
]

// Node data types short codes for minification
const DataTypes = {
  "recipe": "r",
  "balancer": "b",
  "settlement": "s",
  get: function (id?: string): string { return this[(id ?? "recipe") as keyof typeof DataTypes] as string || "r" },
  find: function (val: string | undefined): "recipe" | "balancer" | "settlement" {
    const found = Object.entries(this).find(([, v]) => v === val)?.[0] as "recipe" | "balancer" | "settlement" | undefined;
    return found ?? "recipe";
  }
}

export type MinifiedStateV3 = [
  number, // version
  string, // name
  string, // zone
  string, // icon (optional)
  [ // nodes
    string, // type (React Flow node type)
    string, // id
    number, // x
    number, // y
    string, // recipeId
    boolean, // ltr
    string, // dataType (recipe, balancer, settlement)
  ][],
  [ // edges
    string, // type
    string, // productId
    string, // source
    string, // target
  ][],
  [ // goals
    string, // productId
    number, // qty
    "eq" | "lt" | "gt", // type
    boolean, // isOutput
  ][],
]

/**
 * V4 nodes are heterogeneous: recipe nodes and annotation nodes have different tuple shapes.
 * Recipe node tuple: [nodeType, id, x, y, recipeId, ltr, dataType]
 * Annotation node tuple: [nodeType, id, x, y, text]
 */
export type MinifiedRecipeNodeV4 = [
  string, // nodeType ("n")
  string, // id
  number, // x
  number, // y
  string, // recipeId
  boolean, // ltr
  string, // dataType (recipe, balancer, settlement)
];

export type MinifiedAnnotationNodeV4 = [
  string, // nodeType ("a")
  string, // id
  number, // x
  number, // y
  string, // text
];

export type MinifiedStateV4 = [
  number, // version (4)
  string, // name
  string, // zone
  string, // icon (optional)
  (MinifiedRecipeNodeV4 | MinifiedAnnotationNodeV4)[], // nodes
  [ // edges
    string, // type
    string, // productId
    string, // source
    string, // target
  ][],
  [ // goals
    string, // productId
    number, // qty
    "eq" | "lt" | "gt", // type
    boolean, // isOutput
  ][],
]

const currentVersion = 4;
/**
 * Take Graph Store data and strip it to the basics needed to import
 * Strips out all keys in favor of an array with strict positions.
 * Any change to the data here needs to be versioned. 
 * Increase the currentVersion and make a migration for the old one in unminifyVersion
 */
export function minify<T extends GraphCoreData>(state: T, zone: string, icon?: string): MinifiedStateV4 {
  return [
    currentVersion,
    state.name,
    zone,
    icon || "",
    Object.values(state.nodes).map((n): MinifiedRecipeNodeV4 | MinifiedAnnotationNodeV4 => {
      if (isAnnotationNode(n)) {
        return [
          NodeTypes.get(n.type) as string,
          n.id,
          n.position.x,
          n.position.y,
          n.data.text,
        ];
      }
      if (isRecipeNode(n)) {
        return [
          NodeTypes.get(n.type) as string,
          n.id,
          n.position.x,
          n.position.y,
          n.data.recipeId,
          n.data.ltr ?? true,
          DataTypes.get(n.data.type),
        ];
      }
      // Unreachable for known node types
      throw new Error(`Unknown node type: ${(n as { type: string }).type}`);
    }),
    Object.values(state.edges).map(e => [
      EdgeTypes.get(e.type) as string,
      e.sourceHandle,
      e.source,
      e.target,
    ]),
    state.goals.map(g => [
      g.productId,
      g.qty,
      g.type,
      g.dir === "output",
    ])
  ];
}

export const unminify = (data: unknown): GraphImportData => {
  const unmin = new Unminify();
  if (!unmin.validate(data)) throw new Error("Invalid data");

  return unmin.unminify(data);
}

type MinifiedStateBase = [
  number, // version
  ...unknown[]
]

class Unminify {
  public versions = {
    1: this.one.bind(this),
    2: this.two.bind(this),
    3: this.three.bind(this),
    4: this.four.bind(this),
  };

  constructor() { }

  validate(data: unknown): data is MinifiedStateBase {
    if (!Array.isArray(data)) throw new Error("Invalid data: not an array");
    if (data.length < 5) throw new Error("Invalid data: wrong length (expected at least 5 elements)");
    if (typeof data[0] !== "number") throw new Error("Invalid data: version number missing");
    if (data[0] < 1) throw new Error("Unsupported version: " + data[0]);
    if (data[0] > currentVersion) throw new Error("Unsupported version: " + data[0]);
    if (this.hasVersion(data[0]) === false) throw new Error("Unsupported version: " + data[0]);

    return true;
  }

  hasVersion(v: number): boolean {
    return v in this.versions;
  }

  unminify(m: MinifiedStateBase): GraphImportData {
    if (this.hasVersion(m[0]) === false) throw new Error("Unsupported version: " + m[0]);

    return this.versions[m[0] as keyof typeof this.versions](m);
  }

  one(data: MinifiedStateBase): GraphImportData {
    const min = data as MinifiedStateV1;
    const nodes: Map<string, RecipeId> = new Map();
    return {
      name: min[1],
      zoneName: "",
      icon: "",
      nodes: min[2].map(n => {
        const recipeId = n[4] as RecipeId;
        if (recipes.has(recipeId) === false) {
          throw new Error("Unknown recipeId in node: " + n[4]);
        }

        nodes.set(n[1], recipeId);
        return {
          id: n[1],
          type: "recipe-node" as const,
          position: { x: n[2], y: n[3] },
          data: { recipeId: recipeId, ltr: n[5], type: 'recipe' as const },
        }
      }),
      edges: min[3].map(e => {
        if (nodes.has(e[2]) === false) {
          throw new Error("Unknown source node in edge: " + e[2]);
        }
        if (nodes.has(e[3]) === false) {
          throw new Error("Unknown target node in edge: " + e[3]);
        }

        const sourceOutputs = getRecipeOutputs(nodes.get(e[2])!);
        const targetInputs = getRecipeInputs(nodes.get(e[3])!);

        if (!sourceOutputs.some(p => p.id === e[1])) {
          throw new Error("Product " + e[1] + " for edge not found in source recipe outputs in " + nodes.get(e[2]));
        }
        if (!targetInputs.some(p => p.id === e[1])) {
          throw new Error("Product " + e[1] + " for edge not found in target recipe inputs in " + nodes.get(e[3]));
        }
        return {
          type: EdgeTypes.find(e[0]) || "button-edge",
          source: e[2],
          target: e[3],
          product: e[1] as ProductId,
        }
      }),
      goals: min[4].map(g => ({
        productId: g[0] as ProductId,
        qty: g[1],
        type: g[2],
        dir: g[3] ? "output" : "input",
      }))
    }
  }

  two(data: MinifiedStateBase): GraphImportData {
    const min = data as MinifiedStateV2;
    const minV1: MinifiedStateV1 = [
      1,
      min[1],
      min[4],
      min[5],
      min[6],
    ]
    return {
      ...this.versions[1](minV1),
      zoneName: min[2],
      icon: min[3],
    }
  }

  // V3 is a V2 type, but each node has a new field on the end indicating it's data type
  // V1 now defaults to recipe, then is overridden here
  three(data: MinifiedStateBase): GraphImportData {
    const min = data as MinifiedStateV3;
    const v2 = this.versions[2](min);
    // V3 only had recipe nodes, so safely narrow
    const recipeNodes = v2.nodes as GraphImportRecipeNode[];
    return {
      ...v2,
      nodes: recipeNodes.map((n, index) => {
        const dataType = DataTypes.find(min[4][index][6]) || "recipe";
        return {
          ...n,
          data: {
            ...n.data,
            type: dataType,
          },
        } satisfies GraphImportRecipeNode;
      }),
    }
  }

  // V4 adds support for annotation nodes alongside recipe nodes.
  // Node tuples are heterogeneous — annotation nodes have a shorter tuple with text.
  four(data: MinifiedStateBase): GraphImportData {
    const min = data as MinifiedStateV4;
    // Reuse V3 for edges and goals (identical format), but handle nodes manually
    const annotationNodeTypeCode = NodeTypes.get("annotation-node");

    const nodes: GraphImportData["nodes"] = min[4].map(n => {
      const nodeTypeCode = n[0];
      if (nodeTypeCode === annotationNodeTypeCode) {
        // Annotation node: [type, id, x, y, text]
        const ann = n as MinifiedAnnotationNodeV4;
        return {
          id: ann[1],
          type: "annotation-node" as const,
          position: { x: ann[2], y: ann[3] },
          data: { text: ann[4] },
        };
      }
      // Recipe node: [type, id, x, y, recipeId, ltr, dataType]
      const rec = n as MinifiedRecipeNodeV4;
      const recipeId = rec[4] as RecipeId;
      if (recipes.has(recipeId) === false) {
        throw new Error("Unknown recipeId in node: " + rec[4]);
      }
      const dataType = DataTypes.find(rec[6]) || "recipe";
      return {
        id: rec[1],
        type: "recipe-node" as const,
        position: { x: rec[2], y: rec[3] },
        data: {
          type: dataType,
          recipeId: recipeId,
          ltr: rec[5],
        },
      };
    });

    return {
      name: min[1],
      zoneName: min[2],
      icon: min[3],
      nodes,
      edges: min[5].map(e => {
        return {
          type: EdgeTypes.find(e[0]) || "button-edge",
          source: e[2],
          target: e[3],
          product: e[1] as ProductId,
        }
      }),
      goals: min[6].map(g => ({
        productId: g[0] as ProductId,
        qty: g[1],
        type: g[2],
        dir: g[3] ? "output" : "input",
      }))
    };
  }
}

/**
 * JSON.stringify, gzip, base64
 * @param state anything that can be JSON.stringified
 * @returns 
 */
export const compress = async (state: unknown): Promise<string> => {
  try {
    const cs = new CompressionStream("gzip");

    const jsonstr = JSON.stringify(state, hydration.replacer);
    const bytestream = new TextEncoder().encode(jsonstr);
    const writer = cs.writable.getWriter();
    writer.write(bytestream);
    writer.close();
    const reader = cs.readable.getReader();
    const uint8 = [] as number[];
    while (true) {
      const { value, done } = await reader.read();
      if (value) uint8.push(...value);
      if (done) break;
    }
    reader.cancel();
    let binary = '';
    uint8.forEach(code => {
      binary += String.fromCharCode(code);
    });
    const b64 = btoa(binary);
    try {
      await writer.close();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) { /* Make sure it's closed. Throws an error if already closed */ }

    return b64;
  } catch (e) {
    console.log("Compression error", e);
    throw new Error("Compression failed: " + e);
  }
}

/*
  * base64, gunzip, JSON.parse  
  * @param b64 base64 string
  * @returns parsed object
  */
export const decompress = async (b64: string): Promise<unknown> => {
  const binary = atob(b64);
  const uint8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    uint8[i] = binary.charCodeAt(i);
  }
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(uint8);
  writer.close();
  const reader = ds.readable.getReader();
  const out: number[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (value) out.push(...value);
    if (done) break;
  }
  await reader.cancel();
  const decoded = new TextDecoder().decode(new Uint8Array(out));
  try {
    await writer.close();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) { /* Make sure it's closed. Throws an error if already closed */ }
  return JSON.parse(decoded, hydration.reviver);
}


export type MinifiedStateV1 = [
  number, // version
  string, // name
  [ // nodes
    string, // type
    string, // id
    number, // x
    number, // y
    string, // recipeId
    boolean, // ltr,
  ][],
  [ // edges
    string, // type
    string, // productId
    string, // source
    string, // target
  ][],
  [ // goals
    string, // productId
    number, // qty
    "eq" | "lt" | "gt", // type
    boolean, // isOutput
  ][],
  string?, // icon (optional)
]

/**
 * Bulk export format: flat array of V4 minified factories
 */
export type BulkExportData = MinifiedStateV4[];

/**
 * Result of parsing a bulk import - contains all factories and grouped by zone
 */
export interface BulkImportData {
  factories: GraphImportData[];
  /** Map of zone name to list of factory indices in the factories array */
  zoneGroups: Map<string, number[]>;
  /** Whether all factories belong to a single zone */
  isSingleZone: boolean;
}

/**
 * Minify multiple factories for bulk export
 * Returns a flat array of V4 minified factories
 */
export function minifyBulk(
  factories: Array<{ state: GraphCoreData; zoneName: string; icon?: string }>
): BulkExportData {
  return factories.map(f => minify(f.state, f.zoneName, f.icon));
}

/**
 * Unminify bulk import data (array of factories)
 * Supports both single factory (backward compatible) and array of factories
 */
export function unminifyBulk(data: unknown): BulkImportData {
  // Detect if this is a single factory (v1 or v2) or an array of factories
  if (Array.isArray(data) && data.length > 0) {
    // If first element is a number, it's a single factory (version number)
    if (typeof data[0] === 'number') {
      const factory = unminify(data);
      return {
        factories: [factory],
        zoneGroups: new Map([[factory.zoneName || '', [0]]]),
        isSingleZone: true,
      };
    }

    // Otherwise, it's an array of factories
    const factories: GraphImportData[] = [];
    const zoneGroups = new Map<string, number[]>();

    for (let i = 0; i < data.length; i++) {
      const factory = unminify(data[i]);
      factories.push(factory);

      const zoneName = factory.zoneName || '';
      const indices = zoneGroups.get(zoneName) || [];
      indices.push(i);
      zoneGroups.set(zoneName, indices);
    }

    return {
      factories,
      zoneGroups,
      isSingleZone: zoneGroups.size === 1,
    };
  }

  throw new Error(`Invalid bulk import data: expected an array of factory objects or a single factory object. Received: ${typeof data}${Array.isArray(data) ? ' (empty array)' : ''}`);
}

/**
 * Compress multiple factories for export
 */
export async function compressBulk(data: BulkExportData): Promise<string> {
  return compress(data);
}

/**
 * Decompress and parse bulk import data
 */
export async function decompressBulk(b64: string): Promise<BulkImportData> {
  const data = await decompress(b64);
  return unminifyBulk(data);
}

/**
 * Extract metadata from minified factory data without fully unminifying
 */
export function getFactoryMetadataFromMinified(min: MinifiedStateV2 | MinifiedStateV3 | MinifiedStateV4): FactoryExportMetadata {
  return {
    id: '', // ID is not stored in export, will be assigned on import
    name: min[1],
    zoneName: min[2],
    zoneId: '', // Will be resolved on import
    icon: min[3] || undefined,
    nodeCount: min[4].length,
    edgeCount: min[5].length,
    goalCount: min[6].length,
  };
}
