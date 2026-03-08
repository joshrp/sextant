import { createStore } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { addEdge, applyEdgeChanges, applyNodeChanges, getConnectedEdges, type OnConnect, type OnEdgesChange, type OnNodesChange } from "@xyflow/react";

import type { StorageValue } from "zustand/middleware";
import hydration from "~/hydration";
import type { ProductionZoneStoreData } from "./ZoneStore";
import type { CustomEdgeType } from "../factory/graph/edges";
import type { ButtonEdge, ButtonEdgeData } from "../factory/graph/edges/ButtonEdge";
import type { ProductId, RecipeId } from "../factory/graph/loadJsonData";
import type { CustomNodeType } from "../factory/graph/nodeTypes";
import type { NodeDataTypes, RecipeNodeData, SettlementNodeData } from "../factory/graph/nodes/recipeNodeLogic";
import type { AnnotationNodeData } from "../factory/graph/nodes/annotationNode";
import { createGraphModel, solve } from "../factory/solver/solver";
import type { Constraint, FactoryGoal, GraphModel, GraphScoringMethod, ManifoldOptions, Solution, SolutionStatus } from "../factory/solver/types";
import * as reducers from "~/context/reducers/graphReducers";
import { minify } from "../factory/importexport/importexport";
import type { IDB } from "~/context/idb";
import type { FactoryFixture } from "../factory/fixtures";
import type { ZoneModifiers } from "~/context/zoneModifiers";
import { DEFAULT_ZONE_MODIFIERS } from "~/context/zoneModifiers";

export type GetZoneModifiers = () => ZoneModifiers;

// Default empty settlement options for backward compatibility when importing settlements without options
const EMPTY_SETTLEMENT_OPTIONS: SettlementNodeData["options"] = { 
  inputs: {} as Record<ProductId, boolean>, 
  outputs: {} as Record<ProductId, boolean> 
};

export interface GraphCoreData {
  name: string,
  nodes: CustomNodeType[];
  edges: CustomEdgeType[];
  goals: FactoryGoal[];
}

export interface GraphSolutionState extends GraphCoreData {
  graph?: GraphModel,
  solution?: Solution;
  solutionStatus?: SolutionStatus;
  scoringMethod: GraphScoringMethod;
}
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export interface GraphStoreActions {
  graphUpdateAction: () => Promise<void>;
  solutionUpdateAction: (autoSolve?: boolean) => Promise<void>;
  addNode: (node: CustomNodeType) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: CustomEdgeType) => void;
  onNodesChange: OnNodesChange<CustomNodeType>;
  onEdgesChange: OnEdgesChange;
  setNodeData: (nodeId: string, data: Partial<RecipeNodeData | AnnotationNodeData>) => void,
  setEdgeData: (edgeId: string, data: Partial<ButtonEdgeData>) => void,
  onConnect: OnConnect;
  forceSetNodesEdges: () => void,
  validateManifolds: () => void,
  setManifold: (constraints: Constraint[], on: boolean) => void;
  setScoreMethod: (method: GraphStore["scoringMethod"]) => void;
  setBaseWeights: (weights: ProductionZoneStoreData["weights"]) => void;
  importData: (data: GraphImportData, options?: { skipSolver?: boolean }) => Promise<void>;
  exportTestData: () => string;
  setHighlight: (highlight: DeepPartial<GraphStore['highlight']>) => void;
  getProductsInGraph: () => Set<ProductId> | undefined;
  setSettlementOptions: (nodeId: string, options: SettlementNodeData["options"]) => void;
  setRecipeNodeOptions: (nodeId: string, options: RecipeNodeData["options"]) => void;
  clearAll: () => void;
}

export type HighlightNone = {
  mode: "none";
}
export type HighlightProduct = {
  mode: "product";
  productId: ProductId;
  options: {
    connected: boolean;
    unconnected: boolean;
    inputs: boolean;
    outputs: boolean;
    edges: boolean;
  };
}
export type HighlightEdge = {
  mode: "edge";
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: ProductId;
  targetHandle: ProductId;
}
export type HighlightModes = HighlightNone | HighlightProduct | HighlightEdge;
const defaultHighlightOptions: HighlightProduct["options"] = {
  connected: true,
  unconnected: true,
  inputs: true,
  outputs: true,
  edges: true,
};
export interface GraphStore extends GraphSolutionState, GraphStoreActions {
  id: string,

  baseWeights: ProductionZoneStoreData["weights"];
  weights: Pick<ProductionZoneStoreData["weights"], "infrastructure" | "products">;
  manifoldOptions: ManifoldOptions[];
  highlight: HighlightModes;

}

// export type FactoryStore = UseBoundStore<StoreApi<GraphStore>>;
export type FactoryStore = ReturnType<typeof Store>;

export type GraphStoreProps = { id: string, name: string };

const Store = (idb: IDB, { id, name }: GraphStoreProps, getZoneModifiers: GetZoneModifiers) => {
  const Historical = createStore<{ lastUpdated: number | null }>()(
    devtools(
      persist(
        (set) => ({
          lastUpdated: null,
          setLastUpdated: (time: number) => set({ lastUpdated: time }, false, "setLastUpdated")
        }),
        {
          name: id + "_historical",
          version: 1,
          storage: {
            getItem: async (name) => {
              const str = await (await idb).get("factories", name);

              if (!str) return null;
              const data = JSON.parse(str, hydration.reviver);
              return data;
            },
            setItem: async (name, newValue: StorageValue<{ lastUpdated: number | null }>) => {
              const str = JSON.stringify(newValue, hydration.replacer);

              return (await idb).put("factories", str, name)
            },
            removeItem: () => { },
          },
        }
      )
    )
  );
  const Graph = createStore<GraphStore>()(
    devtools(
      persist(
        (set, get) => ({
          id,
          name,
          nodes: [],
          edges: [],
          goals: [],
          graph: undefined,
          solution: undefined,
          solutionStatus: undefined,
          scoringMethod: "infra",

          baseWeights: {
            infrastructure: new Map<string, number>(),
            products: new Map<ProductId, number>(),
            base: "early",
          },
          weights: {
            infrastructure: new Map<string, number>(),
            products: new Map<ProductId, number>(),
          },
          manifoldOptions: [],

          highlight: { mode: "none" },

          addNode: (node) => {
            set({ nodes: [...get().nodes.concat(node)] }, false, "addNode");
            // Only rebuild graph & re-solve for recipe nodes
            if (node.type === "recipe-node") {
              get().graphUpdateAction();
            }
          },
          addEdge: (connection) => {
            set(state => ({ edges: addEdge(connection, state.edges) }), false, "addEdge");
            get().graphUpdateAction();
          },
          removeNode: (nodeId: string) => {
            const node = get().nodes.filter(n => n.id == nodeId);
            const edges = getConnectedEdges(node, get().edges);
            get().onNodesChange([{
              id: nodeId,
              type: "remove"
            }]);
            get().onEdgesChange(edges.map(e => ({
              type: "remove",
              id: e.id
            })));
            if (node[0]?.type === "recipe-node") {
              get().graphUpdateAction();
            }
          },
          onNodesChange: (changes) => {
            set({
              nodes: applyNodeChanges(changes, get().nodes),
            }, false, "onNodesChange");
          },
          onEdgesChange: (changes) => {
            set({
              edges: applyEdgeChanges(changes, get().edges) as CustomEdgeType[],
            }, false, "onEdgesChange");

            // Handle edge selection to activate highlight mode
            const selectChanges = changes.filter(change => change.type === "select");
            if (selectChanges.length > 0) {
              // Find the first selected edge
              const selectedChange = selectChanges.find(change => change.selected === true);
              if (selectedChange && selectedChange.type === "select") {
                const edge = get().edges.find(e => e.id === selectedChange.id) as ButtonEdge | undefined;
                if (edge) {
                  get().setHighlight({
                    mode: "edge",
                    edgeId: edge.id,
                    sourceNodeId: edge.source,
                    targetNodeId: edge.target,
                    sourceHandle: edge.sourceHandle,
                    targetHandle: edge.targetHandle,
                  });
                }
              } else {
                // No selected edge found, clear highlight if all are deselected
                const hasAnySelected = selectChanges.some(change => change.selected === true);
                if (!hasAnySelected) {
                  get().setHighlight({ mode: "none" });
                }
              }
            }

            if (changes.filter(change => change.type === "remove").length > 0) {
              get().graphUpdateAction();
            }
          },
          onConnect: (connection) => {
            if (connection.sourceHandle !== connection.targetHandle) {
              console.warn("Source and target handles do not match, connection ignored.");
              return;
            }

            set({
              edges: addEdge({
                ...connection,
                type: "button-edge",
              } as ButtonEdge, get().edges),
            });
            get().graphUpdateAction();

          },
          graphUpdateAction: async () => {
            try {
              console.log('Using zone modifiers', getZoneModifiers());
              set({
                graph: createGraphModel(get().nodes, get().edges, getZoneModifiers()),
              }, false, "graphUpdateAction");
              // console.log("Graph created", get().graph);
              get().validateManifolds();
            } catch (e) {
              console.error("Error in solver", e);
              return;
            }

            return get().solutionUpdateAction(true);
          },
          solutionUpdateAction: async (autoSolve: boolean = false) => {
            set({ solutionStatus: "Running" }, false, "solutionRunning");

            const solutionUpdate = await reducers.solutionUpdateAction({
              state: get(),
              solver: solve,
              autoSolve
            });

            set(solutionUpdate, false, "solutionUpdateAction");

            const setNode = get().setNodeData;
            solutionUpdate.solution?.nodeCounts?.forEach(res => setNode(res.nodeId, {
              solution: {
                solved: true,
                runCount: res.count
              }
            }));
          },
          validateManifolds: () => {
            const result = reducers.validateManifolds({
              manifoldOptions: get().manifoldOptions,
              graph: get().graph,
            });
            set({ manifoldOptions: result.manifoldOptions }, false, "validateManifolds");
          },
          setManifold: (constraints: Constraint[], on: boolean) => {
            if (on) {
              set({
                manifoldOptions: [...get().manifoldOptions, ...constraints.map(constraint => ({
                  constraintId: constraint.id,
                  edges: constraint.edges,
                  free: true
                }))]
              })
            } else {
              set({
                manifoldOptions: get().manifoldOptions.filter(m => constraints.findIndex(c => c.id == m.constraintId) == -1)
              });
            }

            return get().solutionUpdateAction();
          },
          setScoreMethod: (method: "infra" | "inputs" | "outputs" | "footprint") => {
            set(state => reducers.updateScoringMethod(state, method), false, "setScoreMethod");
            get().solutionUpdateAction(false);
          },
          setNodeData: (nodeId: string, data: Partial<NodeDataTypes>) => {
            set(state => reducers.updateNodeData(state, nodeId, data), false, "setNodeData");
          },
          setRecipeNodeOptions: (nodeId: string, options: RecipeNodeData["options"]) => {
            set(state => reducers.updateRecipeNodeOptions(state, nodeId, options), false, "setRecipeNodeOptions");
            get().graphUpdateAction();
          },
          setSettlementOptions: (nodeId: string, options: SettlementNodeData["options"]) => {
            set(state => reducers.updateSettlementOptions(state, nodeId, options), false, "setSettlementOptions");
            get().graphUpdateAction();
          },
          setEdgeData: (edgeId: string, data: Partial<ButtonEdgeData>) => {
            set(state => reducers.updateEdgeData(state, edgeId, data), false, "setEdgeData");
          },
          clearAll: () => {
            set({ nodes: [], edges: [], graph: undefined, solution: undefined, solutionStatus: undefined }, false, "clearAll");
          },
          // Sometimes ReactFlow just needs a kick
          forceSetNodesEdges: () => {
            console.log('Forcing set nodes and edges', get().nodes.length, get().edges.length);
            set(state => reducers.cloneNodesEdges(state), false, "forceSetNodesEdges");
          },
          setBaseWeights: (weights: ProductionZoneStoreData["weights"]) => {
            const newState = reducers.updateBaseWeights(get(), weights);
            if (newState !== get()) {
              set(newState, false, "setWeights");
              get().solutionUpdateAction(false);
            }
          },
          setHighlight: (highlight) => {
            if (!highlight) {
              return;
            }
            const current = get().highlight;
            if (current.mode === highlight.mode) {
              // Merge new with current
              if (current.mode === "product" && highlight.mode === "product") {
                set({ highlight: { ...current, ...highlight, options: { ...defaultHighlightOptions, ...current.options, ...highlight.options } } }, false, "setHighlight");
              } else {
                set({ highlight: highlight as HighlightModes }, false, "setHighlight");
              }
            } else {
              set({
                highlight: highlight as HighlightModes
              });
            }
          },
          importData: async (data: GraphImportData, options?: { skipSolver?: boolean }) => {

            const newNodes: GraphCoreData["nodes"] = data.nodes.map(n => {
              // Handle annotation nodes
              if (n.type === 'annotation-node') {
                return {
                  id: n.id,
                  type: 'annotation-node' as const,
                  position: n.position,
                  data: { text: n.data.text },
                };
              }

              // After annotation-node check, n is narrowed to GraphImportRecipeNode
              // Default to "recipe" type if not specified for backwards compatibility
              const nodeType = n.data.type ?? "recipe";
              
              // Construct properly typed node data based on node type
              let nodeData: NodeDataTypes;
              if (nodeType === "settlement") {
                nodeData = {
                  type: "settlement",
                  recipeId: n.data.recipeId,
                  ltr: n.data.ltr,
                  options: n.data.options
                    ? { inputs: n.data.options.inputs ?? {}, outputs: n.data.options.outputs ?? {} }
                    : EMPTY_SETTLEMENT_OPTIONS,
                };
              } else if (nodeType === "balancer") {
                nodeData = {
                  type: "balancer",
                  recipeId: n.data.recipeId,
                  ltr: n.data.ltr,
                };
              } else {
                nodeData = {
                  type: "recipe",
                  recipeId: n.data.recipeId,
                  ltr: n.data.ltr,
                  ...(n.data.options?.useRecycling !== undefined && {
                    options: { useRecycling: n.data.options.useRecycling }
                  }),
                };
              }
              
              return {
                id: n.id,
                type: 'recipe-node' as const,
                position: n.position,
                data: nodeData,
              }
            });

            const newEdges: GraphCoreData["edges"] = data.edges.map(e => ({
              id: `${e.source}-${e.target}-${e.product}`,
              source: e.source,
              target: e.target,
              sourceHandle: e.product,
              targetHandle: e.product,
              type: "button-edge",
            }))

            const newGoals: GraphCoreData["goals"] = data.goals.map(g => ({
              productId: g.productId,
              qty: g.qty,
              type: g.type,
              dir: g.dir,
            }));

            set({
              name: data.name,
              nodes: newNodes,
              edges: newEdges,
              goals: newGoals,
            }, false, "importData");

            if (!options?.skipSolver) {
              await get().graphUpdateAction();
            }
          },
          getProductsInGraph: () => {
            const productsSet = new Set<ProductId>();
            if (!get().graph?.graph) return undefined;

            for (const node of Object.keys(get().graph!.graph)) {
              const nodeConnections = get().graph?.graph[node];
              if (!nodeConnections) continue;
              for (const inputProductId of Object.keys(nodeConnections.inputs) as ProductId[]) {
                productsSet.add(inputProductId);
              }
              for (const outputProductId of Object.keys(nodeConnections.outputs) as ProductId[]) {
                productsSet.add(outputProductId);
              }
            }
            return productsSet
          },

          exportTestData: () => {
            const state = get();

            // Use minify to get the factory data in the same format as import/export
            const minifiedFactory = minify(state, "test-zone");

            // Include zone modifiers only when they differ from defaults
            const modifiers = getZoneModifiers();
            const hasNonDefaultModifiers = (Object.keys(modifiers) as Array<keyof ZoneModifiers>).some(
              k => modifiers[k] !== DEFAULT_ZONE_MODIFIERS[k]
            );

            // Gather additional test inputs
            const testData: FactoryFixture = {
              factory: minifiedFactory,
              manifoldOptions: state.manifoldOptions,
              scoringMethod: state.scoringMethod,
              previousSolutionObjectiveValue: state.solution?.ObjectiveValue,
              ...(hasNonDefaultModifiers ? { zoneModifiers: modifiers } : {}),
              expected: state.solution ? {
                objectiveValue: state.solution.ObjectiveValue,
                nodeCounts: state.solution.nodeCounts,
                infrastructure: state.solution.infrastructure,
                products: state.solution.products,
                manifolds: state.solution.manifolds,
              } : undefined,
            };

            return JSON.stringify(testData, null, 2);
          },
        }),
        { // Persisted state options
          name: id,
          version: 2,
          storage: {
            getItem: async (name) => {
              const str = await (await idb).get("factories", name);

              if (!str) return null;
              const data = JSON.parse(str, hydration.reviver);
              return data;
            },
            setItem: async (name, newValue: StorageValue<GraphStore>) => {
              const str = JSON.stringify(newValue, hydration.replacer);
              return (await idb).put("factories", str, name)
            },
            removeItem: () => { },
          },
          migrate: (persistedState: unknown, currentVersion: number) => {
            if (!persistedState || !('id' in (persistedState as GraphStore))) {
              console.log("No persisted state found, or invalid, something is weird in migrate.");
              return persistedState as GraphStore;
            }
            const newState = persistedState as GraphStore;

            if (currentVersion === 1) {
              newState.weights = {
                infrastructure: new Map<string, number>(),
                products: new Map<ProductId, number>(),
              };
              console.log("Migrated FactoryStore from version 1 to include weights");
            }
            console.log("Migrated FactoryStore to new version from", currentVersion, newState);
            return newState;
          }
        }
      )
    )
  );

  return {
    Graph,
    Historical
  }
}

export default Store;

export type GraphImportData = {
  name: string;
  icon: string;
  zoneName: string;
  nodes: (GraphImportRecipeNode | GraphImportAnnotationNode)[],
  edges: {
    type: string;
    source: string;
    target: string;
    product: ProductId;
  }[],
  goals: {
    productId: ProductId;
    qty: number;
    type: "eq" | "lt" | "gt";
    dir: "input" | "output";
  }[]
};

export type GraphImportRecipeNode = {
  id: string;
  type: "recipe-node";
  position: { x: number; y: number; };
  data: {
    type?: "recipe" | "balancer" | "settlement";
    recipeId: RecipeId;
    ltr?: boolean;
    options?: {
      inputs?: Record<ProductId, boolean>;
      outputs?: Record<ProductId, boolean>;
      useRecycling?: boolean;
    };
  };
};

export type GraphImportAnnotationNode = {
  id: string;
  type: "annotation-node";
  position: { x: number; y: number; };
  data: {
    text: string;
  };
};
