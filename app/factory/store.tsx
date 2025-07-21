import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import debounce from "just-debounce-it";

import { applyEdgeChanges, applyNodeChanges, getConnectedEdges, type OnEdgesChange, type OnNodesChange } from "@xyflow/react";
import {
  addEdge,
  type OnConnect,
} from "@xyflow/react";

import type { CustomNodeType, } from "./graph/nodes";
import type { CustomEdgeType } from "./graph/edges";
import type { ButtonEdge } from "./graph/edges/ButtonEdge";
import type { RecipeNodeData } from "./graph/RecipeNode";
import { createGraph, solve, type GraphModel } from "./solver/solver";
import type { FactoryGoal, Solution } from "./solver/types";
import { temporal, type TemporalState } from "zundo";
import equal from "fast-deep-equal";
import type { StorageValue } from "zustand/middleware";

export interface GraphStore {
  name: string,
  nodes: CustomNodeType[];
  edges: CustomEdgeType[];
  throttledNodeUpdate: {
    nodes: CustomNodeType[],
    edges: CustomEdgeType[],
    updateTime: number,
    throttle: number,
  };
  graph?: GraphModel,
  goals: FactoryGoal[];
  freeConstraints: string[],
  solution?: Solution;
  graphUpdateAction: () => void;
  solutionUpdateAction: () => void;
  addNode: (node: CustomNodeType) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: CustomEdgeType) => void;
  onNodesChange: OnNodesChange<CustomNodeType>;
  onEdgesChange: OnEdgesChange;
  setNodeData: (nodeId: string, data: Partial<RecipeNodeData>) => void,
  onConnect: OnConnect;
  forceSetNodesEdges: () => void,
}

// export type FactoryStore = UseBoundStore<StoreApi<GraphStore>>;
export type FactoryStore = ReturnType<typeof useStore>;

export type GraphStoreProps = Pick<GraphStore, "nodes" | "edges" | "goals"> & {
  id: string
};

const useStore = ({ id, nodes, edges, goals }: GraphStoreProps) => create<GraphStore>()(
  persist(
    devtools(
      temporal(
        (set, get) => ({
          name: 'Default Factory',
          nodes,
          edges,
          goals,
          freeConstraints: [],
          graph: undefined,
          solution: undefined,
          throttledNodeUpdate: {
            nodes,
            edges,
            updateTime: (new Date().getTime()),
            throttle: 1000,
          },
          addNode: (node) => {
            set(state => ({ nodes: state.nodes.concat(node) }));
            get().graphUpdateAction();
          },
          addEdge: (connection) => {
            set(state => ({ edges: addEdge(connection, state.edges) }));
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
            });
            const nowTime = new Date().getTime();
            if (nowTime - get().throttledNodeUpdate.updateTime > get().throttledNodeUpdate.throttle)
              set({
                throttledNodeUpdate: {
                  nodes: get().nodes,
                  edges: get().edges,
                  updateTime: nowTime,
                  throttle: 1000
                }
              });
          },
          onEdgesChange: (changes) => {
            set({
              edges: applyEdgeChanges(changes, get().edges) as CustomEdgeType[],
            });

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
              set({ 
                graph: createGraph(get().nodes, get().edges) ,
                freeConstraints: [],
              });
            } catch (e) {
              console.error("Error in solver", e);
              return;
            }
            
            get().solutionUpdateAction();
          },
          solutionUpdateAction: async () => {
            const graph = get().graph
            if (!graph) return

            const solution = await solve(graph, get().goals, get().freeConstraints);
            
            set({ solution: solution })
            const setNode = get().setNodeData;
            const solved = solution.status == "Solved"
            solution.nodeCounts?.forEach(res => setNode(res.nodeId, {
              solution: {
                solved,
                runCount: solved ? res.count : 0
              }
            }));
          },
          setNodeData: (nodeId: string, data: Partial<RecipeNodeData>) => {
            set({
              nodes: get().nodes.map(node => {
                if (node.id === nodeId)
                  return { ...node, data: { ...node.data, ...data } };
                return node;
              })
            })
          },
          // Sometimes ReactFlow just needs a kick
          forceSetNodesEdges: () => {
            console.log('Forcing set nodes and edges', get().nodes.length, get().edges.length);
            set({
              nodes: [...get().nodes],
              edges: [...get().edges]
            });
          }
        }),
        {
          wrapTemporal: (storeInitializer) => {
            return persist(storeInitializer, {
              name: id + '_temporal_persist',
              storage: {
                getItem: (name) => {
                  const str = localStorage.getItem(name);
                  if (!str) return null;
                  const existingValue = JSON.parse(str);
                  return {
                    ...existingValue,
                    state: {
                      ...existingValue.state,
                      pastStates: existingValue.state.pastStates.map((s: GraphStore) => hydration.set(s)),
                      futureStates: existingValue.state.futureStates.map((s: GraphStore) => hydration.set(s))
                    }
                  }
                },
                setItem: (name, newValue: StorageValue<TemporalState<GraphStore>>) => {
                  const str = JSON.stringify({
                    ...newValue,
                    state: {
                      ...newValue.state,
                      pastStates: newValue.state.pastStates.map(s => hydration.set(s)),
                      futureStates: newValue.state.futureStates.map(s => hydration.set(s))
                    }
                  })

                  localStorage.setItem(name, str)
                },
                removeItem: (name) => localStorage.removeItem(name),
              },
            })
          },

          equality(pastState, currentState) {
            // Only save an undo state if the goals change,
            // or if the solver is recreated, becuase that only happens
            // when something significant in the graph changes 
            // recipes, edge connections, goals etc.
            let changed = false;
            try {
              changed ||= !equal(pastState.goals, currentState.goals);
              changed ||= !equal(pastState.graph, currentState.graph);
              changed ||= !equal(pastState.edges, currentState.edges);
              changed ||= pastState.nodes.reduce((hasChanged, pastNode, i) =>
                hasChanged || !equal(pastNode.data, currentState.nodes[i]?.data),
                changed as boolean
              );
            } catch (e) {
              console.error('Error checking equality', e)
            }

            return !changed;
          },
          handleSet: (handleSet) => {
            const myDebouncedFunction = debounce<typeof handleSet>(s => handleSet(s), 1000, false);

            return (state) => state && myDebouncedFunction(state, true);
          },

        }
      )
    ),
    {
      name: id + "_zustand",
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const existingValue = JSON.parse(str);
          return {
            ...existingValue,
            state: hydration.get(existingValue.state)
          }
        },
        setItem: (name, newValue: StorageValue<GraphStore>) => {
          const str = JSON.stringify({
            ...newValue,
            state: hydration.set(newValue.state)
          })

          localStorage.setItem(name, str)
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);

const hydration = {
  get: (store: GraphStore) => {
    return {
      ...store,
    }
  },
  set: (store: Partial<GraphStore>) => {
    return {
      ...store,
    }
  }
}
export default useStore;
