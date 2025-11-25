import {
  Background,
  Controls,
  ReactFlow,
  useReactFlow,
  type FinalConnectionState
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import type { AddRecipeNode } from "../factory";
import useFactory from "../FactoryContext";
import { type GraphStore } from "../store";
import { edgeTypes, type CustomEdgeType } from "./edges";
import type { ProductId } from "./loadJsonData";
import { nodeTypes, type CustomNodeType } from "./nodes";

const selector = (state: GraphStore) => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  onConnect: state.onConnect,
  addEdge: state.addEdge,
  addNode: state.addNode,
});


type props = {
  addNewRecipe: (addRecipeNode: AddRecipeNode) => void
};

export default function Graph({ addNewRecipe }: props) {
  const store = useFactory().store;

  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useStore(
    store,
    useShallow(selector),
  );
  console.log("Rendering graph with nodes", nodes.length, "edges", edges.length);

  // Only fit viewport to nodes when we go from none to some,
  // This could fire other times, but mostly it's just the page loading
  const fit = nodes.length > 0;
  const { fitBounds, getNodesBounds, screenToFlowPosition } = useReactFlow();
  useEffect(() => {
    fitBounds(getNodesBounds(nodes), {
      padding: 0.4,
      duration: 400
    }); return;
  }, [fitBounds, fit]);

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
    // when a connection is dropped on the pane it's not valid 
    const productId = connectionState.fromHandle?.id as ProductId | undefined;
    if (!connectionState.isValid && connectionState.fromHandle && productId) {
      // we need to remove the wrapper bounds, in order to get the correct position
      const { clientX, clientY } =
        'changedTouches' in event ? event.changedTouches[0] : event;

      const dropPosition = screenToFlowPosition({
        x: clientX,
        y: clientY,
      });

      const addingSource = connectionState.fromHandle.type == "target";
      addNewRecipe({
        productId,
        position: {
          x: dropPosition.x + 200 * (addingSource ? -1 : 1),
          y: dropPosition.y - 100
        },
        produce: addingSource,
        otherNode: connectionState.fromHandle.nodeId
      });
    }
  }, [screenToFlowPosition, addNewRecipe]);

  return (
    <ReactFlow<CustomNodeType, CustomEdgeType>
      nodes={nodes}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      edges={edges}
      edgeTypes={edgeTypes}
      onEdgesChange={onEdgesChange}
      onConnectEnd={onConnectEnd}
      onConnect={onConnect}
      minZoom={0.1}
      elevateEdgesOnSelect={true}
      colorMode="dark"
    // snapGrid={[20,20]}
    // snapToGrid={true}
    >
      <Background />
      <Controls/>
    </ReactFlow>
  );
}
