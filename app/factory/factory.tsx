import { useCallback, useEffect, useState } from "react";

import { SelectorDialog } from 'app/components/Dialog';
import Graph from "app/factory/graph/graph";
import Sidebar from "app/factory/graph/sidebar";

import {
  loadProductData,
  loadRecipeData,
  type ProductId,
  type RecipeId
} from "./graph/loadJsonData";

import { ReactFlowProvider } from "@xyflow/react";
import useFactory, { useFactoryStore } from "./FactoryContext";
import RecipePicker from "./RecipePicker";
import { FactorySwitches } from "./switches";

const recipeData = loadRecipeData();
const productData = loadProductData();

export function Factory() {
  const store = useFactory().store

  const addNode = useFactoryStore(state => state.addNode);
  const onConnect = useFactoryStore(state => state.onConnect);

  const [ recipeSelectorProductIsOutput, setRecipeSelectorProductIsOutput ] = useState<boolean>(true);
  const [recipeSelectorProductId, setRecipeSelectorProduct] = useState<ProductId | null>(null);
  const recipeSelectorProduct = recipeSelectorProductId ? productData[recipeSelectorProductId] : null
  const newNodeFor = useFactoryStore(state => state.newNodeFor);
  
  useEffect(() => {
      if (newNodeFor) {
        setRecipeSelectorProduct(newNodeFor.productId);
        setRecipeSelectorProductIsOutput(newNodeFor.produce);
      }
  }, [newNodeFor]); 

  const addNewRecipe = (id: ProductId) => {
    setRecipeSelectorProduct(id);
  };

  const addProductToGraph = useCallback((id: RecipeId, productId: ProductId) => {
    if (!productId) return;
    console.log("add product to graph", id, productId, newNodeFor);
    const newNode = {
      id: id + "_" + (new Date().getTime()),
      position: newNodeFor ? {
        // Guess at some offsets for placement, "position" seems to be for the top left corner
        x: newNodeFor.position.x + 200 * (newNodeFor.produce ? -1 : 1),
        y: newNodeFor.position.y - 100 
      } : { x: 100, y: 100 },
      type: "recipe-node",
      data: {
        recipeId: id,
      },
    };

    addNode(newNode);
    setRecipeSelectorProduct(null);
    if (newNodeFor) {
      if (newNodeFor.produce)
        onConnect({
          source: newNode.id,
          target: newNodeFor.otherNode,
          sourceHandle: newNodeFor.productId,
          targetHandle: newNodeFor.productId,
        });
      else
        onConnect({
          source: newNodeFor.otherNode,
          target: newNode.id,
          sourceHandle: newNodeFor.productId,
          targetHandle: newNodeFor.productId,
        });
      
      store.setState({ newNodeFor: undefined });
    }
  }, [recipeData, newNodeFor, addNode, onConnect, store]);

  const blankRecipeSelectorProduct = () => {
    setRecipeSelectorProduct(null);
    store.setState({ newNodeFor: undefined });
  }
  return (
    <div className="h-[90vh] flex flex-row w-full flex-wrap" >
      <div className="factoryActions flex flex-row gap-2 w-full h-10 bg-black">
      
      </div>
      <div className="h-full w-[25vw] resize-x overflow-x-hidden w-max-[50vw] overflow-y-scroll">
        <Sidebar addNewRecipe={addNewRecipe} />
      </div>
      <div className="flex-1 flex flex-col items-center gap-3 h-full">
        <div className="w-full h-full">
          <ReactFlowProvider >
            <Graph />
          </ReactFlowProvider>
        </div>
        <div className="min-h-20 w-full overflow-auto">
          <FactorySwitches/>
        </div>
      </div>

      {recipeSelectorProductId ? (
        <SelectorDialog title={recipeSelectorProduct?.name} isOpen={recipeSelectorProductId !== null} setIsOpen={blankRecipeSelectorProduct}>
          <RecipePicker
            productId={recipeSelectorProductId}
            selectRecipe={(recipeId) => {
              addProductToGraph(recipeId, recipeSelectorProductId)
            }}
            productIs={recipeSelectorProductIsOutput ? "output" : "input"}/>
        </SelectorDialog>
      ) : ("")}
    </div>);
}
