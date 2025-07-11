import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type ReactFlowProps,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { nodeTypes, type CustomNodeType } from "./nodes";
import { edgeTypes, type CustomEdgeType } from "./edges";
import useStore, { type GraphStore } from "../store";
import { useShallow } from "zustand/shallow";

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
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useStore(
    useShallow(selector),
  );
  return (
    <ReactFlow<CustomNodeType, CustomEdgeType>
      nodes={nodes}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      edges={edges}
      edgeTypes={edgeTypes}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      colorMode="dark"
    >
      <Background />
      <MiniMap />
      <Controls />
    </ReactFlow>
  );
}
