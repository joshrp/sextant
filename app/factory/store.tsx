import { create } from "zustand";
import { loadMachineData, loadProductData, loadRecipeData, type ProductId, type Recipe, type RecipeData, type RecipeProduct } from "./graph/loadJsonData";

import { applyEdgeChanges, applyNodeChanges, getOutgoers, type Edge, type OnEdgesChange, type OnNodesChange } from "@xyflow/react";
import {
  addEdge,
  type OnConnect,
} from "@xyflow/react";

import { initialNodes, type CustomNodeType } from "./graph/nodes";
import { initialEdges, type CustomEdgeType } from "./graph/edges";
import { buildNodeConnections, type NodeConnections } from "./solver";

export interface GraphStore {
  nodes: CustomNodeType[];
  edges: CustomEdgeType[];
  nodeConnections: NodeConnections | null;
  constraints: {
    lpp: string;
    openOutputs: ProductId[];
    openInputs: ProductId[];
  };
  graphChangeAction: () => void;
  addNode: (node: CustomNodeType) => void;
  addEdge: (edge: CustomEdgeType) => void;
  onNodesChange: OnNodesChange<CustomNodeType>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  loadingHighs: boolean;
}

const useStore = create<GraphStore>((set, get) => ({
  loadingHighs: true,
  nodes: initialNodes,
  edges: initialEdges,
  nodeConnections: null,
  constraints: {
    lpp: '',
    openOutputs: [],
    openInputs: [],
  },
  addNode: (node) => set((state) => ({ nodes: state.nodes.concat(node) })),
  addEdge: (connection) => set((state) => ({ edges: addEdge(connection, state.edges) })),
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
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
      }, get().edges),
    });

    get().graphChangeAction();
  },
  graphChangeAction: () => {
    set({
      nodeConnections: buildNodeConnections(get().nodes, get().edges)
    });
  },
}));

export default useStore;
