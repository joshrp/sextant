import { useCallback, useEffect, useRef, useState } from "react";

import { SelectorDialog } from 'app/components/Dialog';
import EmptyStateCard from "~/components/EmptyStateCard";
import Graph from "app/factory/graph/graph";
import Sidebar from "app/factory/graph/sidebar";

import {
  loadData,
  type ProductId,
  type RecipeId
} from "./graph/loadJsonData";

import { ChevronDoubleRightIcon } from "@heroicons/react/24/outline";
import { ReactFlowProvider } from "@xyflow/react";
import { FactoryOverlayBar } from "~/components/FactoryOverlayBar";
import FactoryControls from "~/context/FactoryControls";
import { usePlannerStore } from "~/context/PlannerContext";
import { useFactoryStore } from "../context/FactoryContext";
import RecipePicker from "./RecipePicker";
import type { RecipeNode } from "./graph/nodes/RecipeNode";
import type { AnnotationNodeType } from "./graph/nodes/annotationNode";
import { isSentinelPosition } from "./graph/nodePositioning";
import type { HandleDropAlignment } from "./graph/nodes/recipeNodeLogic";

const { products, machines, recipes } = loadData();
console.log("Loaded products", products);
console.log("Loaded machines", machines);
console.log("Loaded recipes", recipes);

export type AddRecipeNode = {
  productId: ProductId;
  position: { x: number; y: number };
  produce: boolean; // true = produce this item, false = consume
  otherNode: string; // The node that this is connecting to, if any
  ltr?: boolean;
  alignToDrop?: HandleDropAlignment;
  getSmartPosition?: (recipeId: RecipeId) => { x: number; y: number };
};

export function Factory() {
  const addNode = useFactoryStore(state => state.addNode);
  const onConnect = useFactoryStore(state => state.onConnect);
  const hasNodes = useFactoryStore(state => state.nodes.length > 0);

  const [addRecipeNode, setAddRecipeNode] = useState<AddRecipeNode | null>(null);
  const recipeSelectorProduct = addRecipeNode ? products.get(addRecipeNode.productId) : null

  /** Create an annotation node at the given position and immediately open its edit dialog.
   * When given the sentinel position, smart positioning is used to find a free slot. */
  const addAnnotationNode = useCallback((position: { x: number; y: number }) => {
    const resolvedPosition = isSentinelPosition(position) && smartPositionRef.current
      ? smartPositionRef.current(null)
      : position;
    const newNode: AnnotationNodeType = {
      id: `annotation_${Date.now()}`,
      type: 'annotation-node',
      position: resolvedPosition,
      data: { text: '', autoEdit: true },
    };
    addNode(newNode);
  }, [addNode]);

  // Sidebar resize state
  const sidebarWidth = usePlannerStore((state) => state.sidebarWidth);
  const setSidebarWidth = usePlannerStore((state) => state.setSidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(sidebarWidth);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Sync currentWidth with store value when it changes (e.g., after hydration)
  useEffect(() => {
    setCurrentWidth(sidebarWidth);
  }, [sidebarWidth]);

  // Handle mouse down on resize handle
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // Handle mouse move for resizing
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!sidebarRef.current) return;

    const sidebarRect = sidebarRef.current.getBoundingClientRect();
    const newWidth = e.clientX - sidebarRect.left;
    // Constrain width between 200px and 600px
    const constrainedWidth = Math.min(Math.max(newWidth, 200), 600);
    setCurrentWidth(constrainedWidth);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    // Save to store when done resizing
    setSidebarWidth(currentWidth);
  }, [currentWidth, setSidebarWidth]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection while resizing
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Ref for Graph to register its smart positioning callback.
  // Accepts RecipeId | null — null is used by annotation nodes.
  const smartPositionRef = useRef<((recipeId: RecipeId | null) => { x: number; y: number }) | null>(null);

  const addNewRecipe = useCallback((recipe: AddRecipeNode) => {
    // For sidebar/controls calls with sentinel position, inject the smart positioning callback from Graph
    if (isSentinelPosition(recipe.position) && !recipe.getSmartPosition && smartPositionRef.current) {
      recipe = { ...recipe, getSmartPosition: smartPositionRef.current };
    }
    setAddRecipeNode(recipe);
  }, []);

  const addProductToGraph = useCallback((id: RecipeId, isBalancer: boolean, recipeAdd: AddRecipeNode) => {

    if (!recipeAdd.productId) return;
    const recipe = recipes.get(id);
    if (!recipe) {
      console.error('Recipe not found:', id);
      return;
    }
    
    // Calculate position - use smart positioning for button-placed nodes (sentinel position)
    let position = recipeAdd.position;
    if (isSentinelPosition(position) && smartPositionRef.current) {
      // Always read from ref to get the latest callback with current nodes state
      position = smartPositionRef.current(id);
    } else if (isSentinelPosition(position) && recipeAdd.getSmartPosition) {
      position = recipeAdd.getSmartPosition(id);
    } else if (isSentinelPosition(position)) {
      // Fallback if callback not available
      position = { x: 100, y: 100 };
    }
    
    // Use ltr from recipeAdd if provided (e.g., from connection-drop), otherwise default to true
    const ltr = recipeAdd.ltr ?? true;
    
    let newNode: RecipeNode;
    if (recipe.type === "settlement") {
      newNode = {
        id: id + "_" + (new Date().getTime()),
        position,
        type: 'recipe-node',
        data: {
          type: recipe.type,
          recipeId: id,
          ltr,
          alignToDrop: recipeAdd.alignToDrop,
          options: {
            inputs: Object.fromEntries(recipe.inputs.map(input => [input.product.id, true])) as Record<ProductId, boolean>,
            outputs: Object.fromEntries(recipe.outputs.map(output => [output.product.id, true])) as Record<ProductId, boolean>,
          }
        },
      };
    } else if (recipe.type === "thermal-storage") {
      newNode = {
        id: id + "_" + (new Date().getTime()),
        position,
        type: 'recipe-node',
        data: {
          type: "thermal-storage",
          recipeId: id,
          ltr,
          alignToDrop: recipeAdd.alignToDrop,
          options: { loss: 10 },
        },
      };
    } else {
      newNode = {
        id: id + "_" + (new Date().getTime()),
        position,
        type: 'recipe-node',
        data: {
          type: recipe.type,
          recipeId: id,
          ltr,
          alignToDrop: recipeAdd.alignToDrop,
        },
      };
    }
    addNode(newNode);
    if (recipeAdd.produce)
      onConnect({
        source: newNode.id,
        target: recipeAdd.otherNode,
        sourceHandle: recipeAdd.productId,
        targetHandle: recipeAdd.productId,
      });
    else
      onConnect({
        source: recipeAdd.otherNode,
        target: newNode.id,
        sourceHandle: recipeAdd.productId,
        targetHandle: recipeAdd.productId,
      });
    setAddRecipeNode(null);

  }, [addNode, onConnect]);
  const blankRecipeSelectorProduct = () => {
    setAddRecipeNode(null);
  }

  return (<>
    <div className="factoryActions flex flex-row w-full h-10 bg-zinc-950">
      <FactoryControls addNewRecipe={addNewRecipe} addAnnotationNode={addAnnotationNode} />
    </div>
    <div className="justify-self-stretch flex flex-row w-full h-[calc(100%-calc(10*var(--spacing)))]">
      <div className="
      relative bg-transparent overflow-x-visible overflow-y-visible
    "
        style={{ width: `calc(${currentWidth}px`, minWidth: '200px', maxWidth: '600px' }}
      >
        <div
          className="absolute z-[1000] top-1/2 -right-7 w-6 h-6 cursor-col-resize hover:text-white text-gray-700 transition-colors"
          onMouseDown={handleMouseDown}
          style={{
            // backgroundColor: isResizing ? 'rgb(59 130 246)' : 'transparent',
          }}
        ><ChevronDoubleRightIcon className="w-full h-full block" /></div>
        <div
          ref={sidebarRef}
          className="
          flex flex-col bg-zinc-950
          overflow-y-scroll overflow-x-hidden
          w-[calc(100%)] h-full
          "
        // w-[calc(100%-(var(--spacing)*2))] h-full
        >
          <Sidebar addNewRecipe={addNewRecipe} />

        </div>
      </div>
      <div className="flex-1">
        <div className="w-full h-full relative">
          <FactoryOverlayBar />
          {!hasNodes && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <EmptyStateCard
                variant="centered"
                text="Add a production goal from the sidebar to start building"
              />
            </div>
          )}
          <ReactFlowProvider>
            <Graph addNewRecipe={addNewRecipe} smartPositionRef={smartPositionRef} />
          </ReactFlowProvider>
        </div>
      </div>
      {addRecipeNode ? (
        <SelectorDialog widthClassName="" title={recipeSelectorProduct?.name} isOpen={addRecipeNode !== null} setIsOpen={blankRecipeSelectorProduct}>
          <RecipePicker
            productId={addRecipeNode.productId}
            selectRecipe={(recipeId, isBalancer) => {
              addProductToGraph(recipeId, isBalancer, addRecipeNode)
            }}
            productIs={addRecipeNode.produce ? "output" : "input"} />
        </SelectorDialog>
      ) : ("")}
    </div>
  </>
  );
}
