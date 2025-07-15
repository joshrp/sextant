import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type ReactFlowProps,
  useReactFlow,
  getNodesBounds
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { nodeTypes, type CustomNodeType } from "./nodes";
import { edgeTypes, type CustomEdgeType } from "./edges";
import { type GraphStore } from "../store";
import { useShallow } from "zustand/shallow";
import { useFactory } from "../FactoryProvider";
import { useEffect } from "react";

export interface GraphProps extends ReactFlowProps<CustomNodeType, CustomEdgeType> {

}

const selector = (state: GraphStore) => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  onConnect: state.onConnect,
  addEdge: state.addEdge,
  addNode: state.addNode,
});

export default function Graph(props: GraphProps) {
  const useStore = useFactory().useStore;

  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useStore(
    useShallow(selector),
  );
  
  const { fitBounds } = useReactFlow();
  useEffect(()=> {fitBounds(getNodesBounds(nodes), {
    padding: 20,
    duration: 200
  }); return;}, [useStore]);

  return (
    <ReactFlow<CustomNodeType, CustomEdgeType>
      nodes={nodes}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      edges={edges}
      edgeTypes={edgeTypes}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      minZoom={0.1}
      colorMode="dark"
    >
      <Background />
      <MiniMap />
      <Controls />
    </ReactFlow>
  );
}
