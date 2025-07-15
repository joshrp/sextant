import { create, type StoreApi, type UseBoundStore } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { type ProductId } from "./graph/loadJsonData";

import { applyEdgeChanges, applyNodeChanges, getConnectedEdges, type EdgeProps, type OnEdgesChange, type OnNodesChange } from "@xyflow/react";
import {
  addEdge,
  type OnConnect,
} from "@xyflow/react";

import { buildNodeConnections, type OpenConnections, type FactoryGoal, type NodeConnections } from "./solver";
import type { CustomNodeType, } from "./graph/nodes";
import type { CustomEdgeType } from "./graph/edges";
import type { ButtonEdge } from "./graph/edges/ButtonEdge";

export interface GraphStore {
  nodes: CustomNodeType[];
  edges: CustomEdgeType[];
  nodeConnections: NodeConnections | null;
  openConnections: OpenConnections | null;
  throttledNodeUpdate: {
    nodes: CustomNodeType[],
    edges: CustomEdgeType[],
    updateTime: number,
    throttle: number,
  };
  constraints: FactoryGoal[];
  graphChangeAction: () => void;
  addNode: (node: CustomNodeType) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: CustomEdgeType) => void;
  onNodesChange: OnNodesChange<CustomNodeType>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  loadingHighs: boolean;
}

// export type FactoryStore = UseBoundStore<StoreApi<GraphStore>>;
export type FactoryStore = ReturnType<typeof useStore>;

export type GraphStoreProps = Pick<GraphStore, "nodes" | "edges" | "constraints"> & {
  id: string
};

const useStore = ({ id, nodes, edges, constraints }: GraphStoreProps) => create<GraphStore>()(
  persist(devtools(
    (set, get) => ({
      loadingHighs: true,
      nodes,
      edges,
      constraints,
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
      graphChangeAction: () => {
        const {nodeConnections, openConnections} = buildNodeConnections(get().nodes, get().edges);
        
        set({
          nodeConnections, 
          openConnections
        });
      },
    })
  ),
  {
    name: id+"_zustand",
  }
)
);

export default useStore;
