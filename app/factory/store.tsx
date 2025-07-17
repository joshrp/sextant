import { create, type StoreApi, type UseBoundStore } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { type ProductId } from "./graph/loadJsonData";

import { applyEdgeChanges, applyNodeChanges, getConnectedEdges, type EdgeProps, type OnEdgesChange, type OnNodesChange } from "@xyflow/react";
import {
  addEdge,
  type OnConnect,
} from "@xyflow/react";

import type { CustomNodeType, } from "./graph/nodes";
import type { CustomEdgeType } from "./graph/edges";
import type { ButtonEdge } from "./graph/edges/ButtonEdge";
import type { RecipeNodeData } from "./graph/RecipeNode";
import Solver from "./solver/solver";
import type { FactoryGoal } from "./solver/types";

export interface GraphStore {
  nodes: CustomNodeType[];
  edges: CustomEdgeType[];
  throttledNodeUpdate: {
    nodes: CustomNodeType[],
    edges: CustomEdgeType[],
    updateTime: number,
    throttle: number,
  };
  solver: Solver,
  goals: FactoryGoal[];
  graphChangeAction: () => void;
  addNode: (node: CustomNodeType) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: CustomEdgeType) => void;
  onNodesChange: OnNodesChange<CustomNodeType>;
  onEdgesChange: OnEdgesChange;
  setNodeData: (nodeId: string, data: Partial<RecipeNodeData>) => void,
  onConnect: OnConnect;
  loadingHighs: boolean;
}

// export type FactoryStore = UseBoundStore<StoreApi<GraphStore>>;
export type FactoryStore = ReturnType<typeof useStore>;

export type GraphStoreProps = Pick<GraphStore, "nodes" | "edges" | "goals"> & {
  id: string
};

const useStore = ({ id, nodes, edges, goals }: GraphStoreProps) => create<GraphStore>()(
  persist(devtools(
    (set, get) => ({
      loadingHighs: true,
      nodes,
      edges,
      goals,
      nodeConnections: null,
      throttledNodeUpdate: {
        nodes,
        edges,
        updateTime: (new Date().getTime()),
        throttle: 1000,
      },
      addNode: (node) => set(state => ({ nodes: state.nodes.concat(node) })),
      addEdge: (connection) => set(state => ({ edges: addEdge(connection, state.edges) })),
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
          get().graphChangeAction();
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

        get().graphChangeAction();
      },
      graphChangeAction: async () => {  
        set({
          solver: new Solver(get().nodes, get().edges)
        });
      },
      setNodeData: (nodeId: string, data: Partial<RecipeNodeData>) => {
        console.log('setting data for',nodeId,data)
        set({nodes: get().nodes.map(node => {
          if (node.id === nodeId) 
            return {...node, data: {...node.data, ...data}};
          return node;
        })})
      }
    })
  ),
  {
    name: id+"_zustand",
  }
)
);

export default useStore;
