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
import { useFactory } from "./FactoryProvider";
import RecipePicker from "./RecipePicker";
import { FactorySwitches } from "./switches";

const recipeData = loadRecipeData();
const productData = loadProductData();

export function Factory() {
  const factory = useFactory();
  const useStore = factory.useStore;

  const addNode = useStore(state => state.addNode);

  const goals = useStore(state => state.goals);
  const graph = useStore(state => state.graph);
  // const solutionUpdateAction = useStore().graphUpdateAction;

  console.log('temporal', useStore.temporal.getState());
  useEffect(() => {
    console.log('use effect', graph, goals)
    
  }, [graph, goals]);

  // const [isOpen, setIsOpen] = useState(false);
  const [recipeSelectorProductId, setRecipeSelectorProduct] = useState<ProductId | null>(null);
  const recipeSelectorProduct = recipeSelectorProductId ? productData[recipeSelectorProductId] : null

  const addNewRecipe = (id: ProductId) => {
    setRecipeSelectorProduct(id);
  };

  const addProductToGraph = useCallback((id: RecipeId, productId: ProductId) => {
    if (!productId) return;

    const newNode = {
      id: id + "_" + (new Date().getTime()),
      // TODO:: Positioning new nodes. ELK?
      position: { x: 100, y: 100 },
      type: "recipe-node",
      data: {
        recipeId: id,
      },
    };

    addNode(newNode);
    setRecipeSelectorProduct(null);
  }, [recipeData]);

  const blankRecipeSelectorProduct = () => {
    setRecipeSelectorProduct(null);
  }

  return (
    <div className="h-[90vh] flex flex-row w-full" >
      <div className="h-full w-[20vw] resize-x overflow-x-hidden w-max-[50vw]">
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
            productIs="output" />
        </SelectorDialog>
      ) : ("")}
    </div>);
}
