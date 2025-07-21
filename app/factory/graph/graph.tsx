import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
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

const selector = (state: GraphStore) => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  onConnect: state.onConnect,
  addEdge: state.addEdge,
  addNode: state.addNode,
});

export default function Graph() {
  const useStore = useFactory().useStore;

  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useStore(
    useShallow(selector),
  );

  // Only fit viewport to nodes when we go from none to some,
  // This could fire other times, but mostly it's just the page loading
  const fit = nodes.length > 0;
  const { fitBounds } = useReactFlow();
  useEffect(()=> {fitBounds(getNodesBounds(nodes), {
    padding: 0.2,
    duration: 200
  }); return;}, [fitBounds, fit]);

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
      snapGrid={[20,20]}
      
      snapToGrid={true}
    >
      <Background />
      <MiniMap />
      <Controls />
    </ReactFlow>
  );
}
