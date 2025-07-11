import { create } from "zustand";
import { loadMachineData, loadProductData, loadRecipeData, type ProductId, type Recipe, type RecipeData, type RecipeProduct } from "./graph/loadJsonData";

import { applyEdgeChanges, applyNodeChanges, getOutgoers, type OnEdgesChange, type OnNodesChange } from "@xyflow/react";
import {
  addEdge,
  type OnConnect,
} from "@xyflow/react";

const recipeData = loadRecipeData();
const machineData = loadMachineData();
const productData = loadProductData();


import { initialNodes, type CustomNodeType } from "./graph/nodes";
import { initialEdges, type CustomEdgeType } from "./graph/edges";

export interface GraphStore {
  nodes: CustomNodeType[];
  edges: CustomEdgeType[];
  constraints: {
    openOutputs: ProductId[];
    openInputs: ProductId[];
  };
  rebuildConstraintsAction: () => void;
  addNode: (node: CustomNodeType) => void;
  addEdge: (edge: CustomEdgeType) => void;
  onNodesChange: OnNodesChange<CustomNodeType>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
}

const useStore = create<GraphStore>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  constraints: {
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
    console.log("edges changed", changes);
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });

    if (changes.filter(change => change.type === "remove").length > 0) {
      get().rebuildConstraintsAction();
    }
  },
  onConnect: (connection) => {
    console.log("new connection", connection.sourceHandle, connection.targetHandle);
    if (connection.sourceHandle !== connection.targetHandle) {
      console.warn("Source and target handles do not match, connection ignored.");
      return;
    }
    
    set({
      edges: addEdge(connection, get().edges),
    });

    get().rebuildConstraintsAction();
  },
  rebuildConstraintsAction: () => {
    set({
      constraints: rebuildContraints(get().nodes, get().edges)
    });
  },
}));

const rebuildContraints = (nodes: CustomNodeType[], edges: CustomEdgeType[]) => {
  console.log("rebuildContraints", nodes, edges);
  const nodeConnections = {} as Record<string, {inputs: string[], outputs: string[]}>;
  edges.forEach(edge => {
    if (!nodeConnections[edge.source]) {
      nodeConnections[edge.source] = { inputs: [], outputs: [] };
    }
    if (!nodeConnections[edge.target]) {
      nodeConnections[edge.target] = { inputs: [], outputs: [] };
    }
    nodeConnections[edge.source].outputs.push(edge.targetHandle || "");
    nodeConnections[edge.target].inputs.push(edge.sourceHandle || "");
  });

  const nodeRecipe = {} as Record<string, Recipe>;
  nodes.forEach(node => {
    if (nodeConnections[node.id] === undefined) {
      nodeConnections[node.id] = { inputs: [], outputs: [] };
    }
    nodeRecipe[node.id] = recipeData[node.data.recipeId];
  });

  let openOutputs = [] as GraphStore["constraints"]["openOutputs"];
  let openInputs = [] as GraphStore["constraints"]["openInputs"];
  nodes.forEach(node => {
    const connections = nodeConnections[node.id];
    if (!connections) return;

    const newoutputs = nodeRecipe[node.id].outputs.filter(output => {
      return connections.outputs.indexOf(output.id) === -1
    }).map(output => output.id);

    openOutputs.push(...newoutputs);

    const newInputs = nodeRecipe[node.id].inputs.filter(input => {
      return connections.inputs.indexOf(input.id) === -1
    }).map(input => input.id);

    openInputs.push(...newInputs);
  });
  console.log("openOutputs", openOutputs);
  return { openOutputs, openInputs };
}

export default useStore;
