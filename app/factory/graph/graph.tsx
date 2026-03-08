import {
  Background,
  ControlButton,
  Controls,
  ReactFlow,
  useReactFlow,
  type FinalConnectionState
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { TrashIcon } from "@heroicons/react/24/outline";
import { type MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import ConfirmDialog from "~/components/ConfirmDialog";
import type { AddRecipeNode } from "../factory";
import useFactory, { useFactoryStore } from "../../context/FactoryContext";
import { type GraphStore } from "../../context/store";
import { edgeTypes, type CustomEdgeType } from "./edges";
import { loadData, type ProductId, type RecipeId } from "./loadJsonData";
import { nodeTypes, type CustomNodeType } from "./nodes";
import { estimateNodeSize, findAvailableSlot, getExistingNodeRects, getExistingNodeWidths } from "./nodePositioning";
import { getViewportBounds } from "./viewportHelpers";

const { recipes } = loadData();

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
  addNewRecipe: (addRecipeNode: AddRecipeNode) => void;
  smartPositionRef: MutableRefObject<((recipeId: RecipeId) => { x: number; y: number }) | null>;
};

// TODO: Component Testing - This component manages complex graph state and needs refactoring:
// 1. Extract connection drop logic (onConnectEnd handler) into a pure function
//    - calculateDropPosition(event, connectionState, screenToFlowPosition)
//    - determineRecipePosition(dropPosition, isAddingSource)
// 2. Extract auto-fit viewport logic into a custom hook (useAutoFitViewport)
// 3. Create integration tests that verify:
//    - Node/edge changes propagate correctly to store
//    - Connection drops create new recipe nodes at correct positions
//    - Viewport auto-fits when nodes are added
// 4. Consider splitting into:
//    - GraphCanvas component (pure rendering)
//    - GraphController component (state management)
// 5. Add unit tests for position calculation logic
// 6. Mock React Flow context for component testing
export default function Graph({ addNewRecipe, smartPositionRef }: props) {
  const store = useFactory().store;
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const clearAll = useFactoryStore(state => state.clearAll);

  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useStore(
    store,
    useShallow(selector),
  );

  // Only fit viewport to nodes when we go from none to some,
  // This could fire other times, but mostly it's just the page loading
  const fit = nodes.length > 0;
  const { fitBounds, getNodesBounds, screenToFlowPosition, getViewport } = useReactFlow();
  
  // Cache container reference for dimension queries
  const containerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    containerRef.current = document.querySelector('.react-flow');
  }, []);
  
  useEffect(() => {
    fitBounds(getNodesBounds(nodes), {
      padding: 0.4,
      duration: 400
    }); return;
  }, [fitBounds, fit]);

  // Calculate smart position for button-placed nodes
  // Pass null as recipeId for annotation nodes (uses a fixed default size).
  const getSmartPositionForRecipe = useCallback((recipeId: RecipeId | null): { x: number; y: number } => {
    const recipe = recipeId ? recipes.get(recipeId) : undefined;
    if (recipeId && !recipe) {
      console.warn('Recipe not found for smart positioning:', recipeId);
      // Return viewport center as fallback
      const viewport = getViewport();
      return {
        x: -viewport.x / viewport.zoom + (window.innerWidth / 2) / viewport.zoom,
        y: -viewport.y / viewport.zoom + (window.innerHeight / 2) / viewport.zoom,
      };
    }
    
    // Annotation nodes have no handles; use 0 so estimateNodeSize returns the base height.
    const handleCount = recipe ? Math.max(recipe.inputs.length, recipe.outputs.length) : 0;
    const viewport = getViewport();
    
    // Use cached container or fallback to window dimensions
    const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth;
    const containerHeight = containerRef.current?.clientHeight ?? window.innerHeight;
    
    // Read nodes directly from the store to get the latest state
    const currentNodes = store.getState().nodes;
    
    const viewportBounds = getViewportBounds(viewport, containerWidth, containerHeight);
    const existingRects = getExistingNodeRects(currentNodes);
    const existingWidths = getExistingNodeWidths(currentNodes);
    const candidateSize = estimateNodeSize(handleCount, existingWidths);
    const observedWidths = existingRects.map(rect => rect.width).filter(width => width > 0);
    const observedHeights = existingRects.map(rect => rect.height).filter(height => height > 0);

    const median = (values: number[]) => {
      if (values.length === 0) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    };

    const conservativeCandidate = {
      width: Math.max(candidateSize.width, median(observedWidths)),
      height: Math.max(candidateSize.height, median(observedHeights)),
    };
    
    return findAvailableSlot(existingRects, conservativeCandidate, viewportBounds);
  }, [store, getViewport]);

  // Register smart position callback with Factory via ref
  useEffect(() => {
    smartPositionRef.current = getSmartPositionForRecipe;
    return () => { smartPositionRef.current = null; };
  }, [smartPositionRef, getSmartPositionForRecipe]);

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

      // Find source node to get its position and ltr for flip calculation
      const sourceNodeId = connectionState.fromHandle.nodeId;
      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      const sourceNodePos = sourceNode?.position ?? { x: 0, y: 0 };
      const sourceLtr = (sourceNode && 'ltr' in sourceNode.data ? sourceNode.data.ltr : undefined) ?? true;

      // Prefer the actual source handle center X for orientation decisions.
      // Node top-left is a coarse proxy and is inaccurate for RTL nodes / right-side inputs.
      const sourceHandleSelector = `.react-flow__node[data-id="${sourceNodeId}"] ` +
        `.react-flow__handle[data-handleid="${productId}"]` +
        `.react-flow__handle-${connectionState.fromHandle.type}`;
      const sourceHandleEl = document.querySelector(sourceHandleSelector) as HTMLElement | null;
      const sourceHandleScreenCenterX = sourceHandleEl
        ? sourceHandleEl.getBoundingClientRect().x + sourceHandleEl.getBoundingClientRect().width / 2
        : undefined;
      const sourceHandleFlowX = sourceHandleScreenCenterX !== undefined
        ? screenToFlowPosition({ x: sourceHandleScreenCenterX, y: clientY }).x
        : sourceNodePos.x;

      const addingSource = connectionState.fromHandle.type == "target";
      // "target" = input handle, "source" = output handle
      const sourceHandleType: 'input' | 'output' = connectionState.fromHandle.type === "target" ? "input" : "output";

      addNewRecipe({
        productId,
        position: dropPosition,
        produce: addingSource,
        otherNode: sourceNodeId,
        ltr: sourceLtr,
        alignToDrop: {
          x: dropPosition.x,
          y: dropPosition.y,
          productId,
          handleType: addingSource ? 'output' : 'input',
          sourceHandleX: sourceHandleFlowX,
          sourceHandleType,
        },
      });
    }
  }, [screenToFlowPosition, addNewRecipe, nodes]);

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
      <Controls>
        <ControlButton
          onClick={() => setClearConfirmOpen(true)}
          title="Clear all nodes"
          disabled={nodes.length === 0}
        >
          <TrashIcon />
        </ControlButton>
      </Controls>
      <ConfirmDialog
        isOpen={clearConfirmOpen}
        onConfirm={() => { clearAll(); setClearConfirmOpen(false); }}
        onCancel={() => setClearConfirmOpen(false)}
        title="Clear all nodes"
        confirmText="Clear all"
        isDestructive
      >
        This will remove all nodes from the canvas. This cannot be undone.

        Use export if you want to save your work before clearing.
      </ConfirmDialog>
    </ReactFlow>
  );
}
