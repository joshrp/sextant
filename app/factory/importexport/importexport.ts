import { loadData, type ProductId, type RecipeId } from "../graph/loadJsonData";
import type { GraphCoreData, GraphImportData } from "../store";
import { getRecipeInputs, getRecipeOutputs } from "~/gameData/utils";

import hydration from "~/hydration";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getBasicB64 = (state: any) => {
  return btoa(JSON.stringify(state, hydration.replacer));
}
const { recipes } = loadData();
const NodeTypes = {
  "recipe-node": "n",
  get: function (id?: string) { return this[(id ?? "recipe-node") as keyof typeof NodeTypes] },
  find: function (val: string): string | undefined { return Object.entries(this).find(([, v]) => v === val)?.[0] }
}
const EdgeTypes = {
  "button-edge": "b",
  get: function (id?: string) { return this[(id ?? "button-edge") as keyof typeof EdgeTypes] },
  find: function (val: string): string | undefined { return Object.entries(this).find(([, v]) => v === val)?.[0] }
}

type MinifiedState = [
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
  ][]
]


const currentVersion = 1;
/**
 * Take Graph Store data and strip it to the basics needed to import
 * Strips out all keys in favor of an array with strict positions.
 * Any change to the data here needs to be versioned. 
 * Increase the currentVersion and make a migration for the old one in unminifyVersion
 */
export function minify<T extends GraphCoreData>(state: T): MinifiedState {
  return [
    currentVersion,
    state.name,
    Object.values(state.nodes).map(n => [
      NodeTypes.get(n.type) as string,
      n.id,
      n.position.x,
      n.position.y,
      n.data.recipeId,
      n.data.ltr ?? true,
    ]),
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

type UnminifyFunc = (m: MinifiedState) => GraphImportData;
class Unminify {
  public versions: { [k: number]: UnminifyFunc } = {
    1: this.one,
  };

  constructor() { }

  validate(data: unknown): data is MinifiedState {
    if (!Array.isArray(data)) throw new Error("Invalid data: not an array");
    if (data.length < 4) throw new Error("Invalid data: wrong length");
    if (typeof data[0] !== "number") throw new Error("Invalid data: version number missing");
    if (data[0] < 1) throw new Error("Unsupported version: " + data[0]);
    if (data[0] > currentVersion) throw new Error("Unsupported version: " + data[0]);
    if (this.hasVersion(data[0]) === false) throw new Error("Unsupported version: " + data[0]);

    return true;
  }

  hasVersion(v: number): boolean {
    return this.versions[v] !== undefined;
  }

  unminify(m: MinifiedState): GraphImportData {
    return this.versions[m[0]](m);
  }

  one(min: MinifiedState): GraphImportData {
    const nodes: Map<string, RecipeId> = new Map();
    return {
      name: min[1],
      nodes: min[2].map(n => {
        const recipeId = n[4] as RecipeId;
        if (recipes.has(recipeId) === false) {
          throw new Error("Unknown recipeId in node: " + n[4]);
        }

        nodes.set(n[1], recipeId);
        return {
          id: n[1],
          type: NodeTypes.find(n[0]) || "recipe-node",
          position: { x: n[2], y: n[3] },
          data: { recipeId: recipeId, ltr: n[5] },
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
    let binary = '';
    uint8.forEach(code => {
      binary += String.fromCharCode(code);
    });
    const b64 = btoa(binary);
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
  const decoded = new TextDecoder().decode(new Uint8Array(out));
  return JSON.parse(decoded, hydration.reviver);
}
