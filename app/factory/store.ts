import { createStore } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { addEdge, applyEdgeChanges, applyNodeChanges, getConnectedEdges, type OnConnect, type OnEdgesChange, type OnNodesChange } from "@xyflow/react";

import { openDB } from "idb";
import type { StorageValue } from "zustand/middleware";
import hydration from "~/hydration";
import type { CustomEdgeType } from "./graph/edges";
import type { ButtonEdge, ButtonEdgeData } from "./graph/edges/ButtonEdge";
import type { ProductId, RecipeId } from "./graph/loadJsonData";
import type { CustomNodeType, } from "./graph/nodes";
import type { RecipeNodeData } from "./graph/RecipeNode";
import type { MatrixStoreData } from "./MatrixProvider";
import { createGraphModel, solve } from "./solver/solver";
import type { Constraint, FactoryGoal, GraphModel, ManifoldOptions, Solution, SolutionStatus } from "./solver/types";

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
  scoringMethod: "infra" | "inputs" | "footprint" | "outputs";
}

export interface GraphStoreActions {
  graphUpdateAction: () => void;
  solutionUpdateAction: (autoSolve?: boolean) => void;
  addNode: (node: CustomNodeType) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: CustomEdgeType) => void;
  onNodesChange: OnNodesChange<CustomNodeType>;
  onEdgesChange: OnEdgesChange;
  setNodeData: (nodeId: string, data: Partial<RecipeNodeData>) => void,
  setEdgeData: (edgeId: string, data: Partial<ButtonEdgeData>) => void,
  onConnect: OnConnect;
  forceSetNodesEdges: () => void,
  validateManifolds: () => void,
  setManifold: (constraints: Constraint[], on: boolean) => void;
  setScoreMethod: (method: GraphStore["scoringMethod"]) => void;
  setBaseWeights: (weights: MatrixStoreData["weights"]) => void;
}

export interface GraphStore extends GraphSolutionState, GraphStoreActions {
  id: string,

  baseWeights: MatrixStoreData["weights"];
  weights: Pick<MatrixStoreData["weights"], "infrastructure" | "products">;
  manifoldOptions: ManifoldOptions[];
}

// export type FactoryStore = UseBoundStore<StoreApi<GraphStore>>;
export type FactoryStore = ReturnType<typeof Store>;

export type GraphStoreProps = { id: string, name: string };

const Store = ({ id, name }: GraphStoreProps) => {

  const idb = getIdb(id);

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
              const str = await (await idb).get('current-state', name);

              if (!str) return null;
              const data = JSON.parse(str, hydration.reviver);
              return data;
            },
            setItem: async (name, newValue: StorageValue<{ lastUpdated: number | null }>) => {
              const str = JSON.stringify(newValue, hydration.replacer);

              return (await idb).put('current-state', str, name)
            },
            removeItem: (name) => localStorage.removeItem(name),
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
          addNode: (node) => {
            console.log("Add node", node, get().nodes.concat(node));
            set({ nodes: [...get().nodes.concat(node)] }, false, "addNode");
            get().graphUpdateAction();
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
            get().graphUpdateAction();
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
                animated: true,
                type: "button-edge",
              } as ButtonEdge, get().edges),
            });
            get().graphUpdateAction();

          },
          graphUpdateAction: () => {
            try {
              console.log('graph update', get().nodes);
              set({
                graph: createGraphModel(get().nodes, get().edges),
              }, false, "graphUpdateAction");
              console.log("Graph created", get().graph);
              get().validateManifolds();
            } catch (e) {
              console.error("Error in solver", e);
              return;
            }

            get().solutionUpdateAction(true);
          },
          solutionUpdateAction: async (autoSolve: boolean = false) => {
            set({ solutionStatus: "Running" }, false, "solutionRunning");
            const graph = get().graph
            if (!graph) return

            const manifoldOptions = get().manifoldOptions;
            const result = await solve(graph, get().goals, manifoldOptions, get().scoringMethod, autoSolve);
            if (result === "Error") {
              console.error("Solver Error");
              set({ solutionStatus: "Error" }, false, "solutionUpdateAction");
              return;
            } else if (result === "Infeasible") {
              set({ solutionStatus: "Infeasible" }, false, "solutionUpdateAction");
              return;
            }
            let status: GraphSolutionState["solutionStatus"] = "Solved";
            if (manifoldOptions.length > 0)
              status = "Partial";

            set({ solution: result.solution, solutionStatus: status }, false, "solutionUpdateAction");
            const setNode = get().setNodeData;
            result.solution.nodeCounts?.forEach(res => setNode(res.nodeId, {
              solution: {
                solved: true,
                runCount: res.count
              }
            }));
            if (result.manifolds) {
              set({
                manifoldOptions: result.manifolds
              }, false, "solutionUpdateAction");
            }
          },
          validateManifolds: () => {
            set({
              manifoldOptions: get().manifoldOptions.map(man => {
                if (man.free == false) return false;
                const constraint = get().graph?.constraints[man.constraintId]
                if (constraint === undefined) return false;
                const constraintEdges = new Set(Object.keys(constraint.edges));
                const manifoldEdges = new Set(Object.keys(man.edges))
                if (constraintEdges.symmetricDifference(manifoldEdges).size === 0) return man;

                // Have a search across the other constraints and see if we can find a match.
                const otherMatch = Object.keys(get().graph?.constraints || {}).find(id => {
                  const edges = get().graph?.constraints[id].edges;
                  return edges && new Set(Object.keys(edges)).symmetricDifference(manifoldEdges).size == 0
                });
                if (otherMatch) {
                  return {
                    constraintId: otherMatch,
                    edges: man.edges,
                    free: man.free
                  }
                }
                return false;
              }).filter(x => x !== false)
            }, false, "validateManifolds");
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
            get().solutionUpdateAction();
          },
          setScoreMethod: (method: "infra" | "inputs" | "outputs" | "footprint") => {
            set({ scoringMethod: method }, false, "setScoreMethod");
            get().solutionUpdateAction(false);
          },
          setNodeData: (nodeId: string, data: Partial<RecipeNodeData>) => {
            set({
              nodes: get().nodes.map(node => {
                if (node.id === nodeId)
                  return { ...node, data: { ...node.data, ...data } };
                return node;
              })
            }, false, "setNodeData");
          },
          setEdgeData: (edgeId: string, data: Partial<ButtonEdgeData>) => {
            set({
              edges: get().edges.map(edge => {
                if (edge.id === edgeId)
                  return { ...edge, data: { ...edge.data, ...data } };
                return edge;
              })
            }, false, "setEdgeData");
          },
          // Sometimes ReactFlow just needs a kick
          forceSetNodesEdges: () => {
            console.log('Forcing set nodes and edges', get().nodes.length, get().edges.length);
            set({
              nodes: [...get().nodes],
              edges: [...get().edges]
            }, false, "forceSetNodesEdges");
          },
          setBaseWeights: (weights: MatrixStoreData["weights"]) => {
            console.log("Setting base weights to", weights, get().goals[0]);
            set({ baseWeights: weights }, false, "setWeights");
            get().solutionUpdateAction(false);
          },
        }),
        { // Persisted state options
          name: id + "_zustand",
          version: 2,
          storage: {
            getItem: async (name) => {
              const str = await (await idb).get('current-state', name);

              if (!str) return null;
              const data = JSON.parse(str, hydration.reviver);
              return data;
            },
            setItem: async (name, newValue: StorageValue<GraphStore>) => {
              const str = JSON.stringify(newValue, hydration.replacer);
              return (await idb).put('current-state', str, name)
            },
            removeItem: (name) => localStorage.removeItem(name),
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

const indexedDBVersion = 1;
const getIdb = (id: string) => openDB(id, indexedDBVersion, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1)
      db.createObjectStore('current-state');
    else
      throw new Error("Database version not supported, please clear site data for this site.");
  },
});

export default Store;

export type GraphImportData = {
  name: string;
  nodes: {
    id: string;
    type: string;
    position: { x: number; y: number; };
    data: { recipeId: RecipeId, ltr?: boolean };
  }[],
  edges: {
    type: string;
    source: string;
    target: string;
    product: string;
  }[],
  goals: {
    productId: string;
    qty: number;
    type: "eq" | "lt" | "gt";
    dir: "input" | "output";
  }[]
};
