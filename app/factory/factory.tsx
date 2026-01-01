import { useCallback, useEffect, useRef, useState } from "react";

import { SelectorDialog } from 'app/components/Dialog';
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
import useFactory, { useFactoryStore } from "./FactoryContext";
import RecipePicker from "./RecipePicker";
import type { RecipeNode } from "./graph/RecipeNode";

const { products, machines, recipes } = loadData();
console.log("Loaded products", products);
console.log("Loaded machines", machines);
console.log("Loaded recipes", recipes);

export type AddRecipeNode = {
  productId: ProductId;
  position: { x: number; y: number };
  produce: boolean; // true = produce this item, false = consume
  otherNode: string; // The node that this is connecting to, if any
};

export function Factory() {
  const store = useFactory().store

  const addNode = useFactoryStore(state => state.addNode);
  const onConnect = useFactoryStore(state => state.onConnect);

  const [addRecipeNode, setAddRecipeNode] = useState<AddRecipeNode | null>(null);
  const recipeSelectorProduct = addRecipeNode ? products.get(addRecipeNode.productId) : null

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

  const addNewRecipe = (recipe: AddRecipeNode) => {
    setAddRecipeNode(recipe);
  };

  const addProductToGraph = useCallback((id: RecipeId, isBalancer: boolean, recipeAdd: AddRecipeNode) => {

    if (!recipeAdd.productId) return;
    const recipe = recipes.get(id);
    if (!recipe) {
      console.error('Recipe not found:', id);
      return;
    }
    let newNode: RecipeNode;
    if (recipe.type === "settlement") {
      newNode = {
        id: id + "_" + (new Date().getTime()),
        position: recipeAdd.position ?? { x: 100, y: 100 },
        type: 'recipe-node',
        data: {
          type: recipe.type,
          recipeId: id,
          ltr: true,
          options: {
            inputs: Object.fromEntries(recipe.inputs.map(input => [input.product.id, true])) as Record<ProductId, boolean>,
            outputs: Object.fromEntries(recipe.outputs.map(output => [output.product.id, true])) as Record<ProductId, boolean>,
          }
        },
      };
    } else {
      newNode = {
        id: id + "_" + (new Date().getTime()),
        position: recipeAdd.position ?? { x: 100, y: 100 },
        type: 'recipe-node',
        data: {
          type: recipe.type,
          recipeId: id,
          ltr: true,
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

  }, [addNode, onConnect, store]);
  const blankRecipeSelectorProduct = () => {
    setAddRecipeNode(null);
  }

  return (<>
    <div className="factoryActions flex flex-row w-full h-10 bg-zinc-950">
      <FactoryControls addNewRecipe={addNewRecipe} />
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
          <ReactFlowProvider>
            <Graph addNewRecipe={addNewRecipe} />
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
