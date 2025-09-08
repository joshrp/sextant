import { useCallback, useState } from "react";

import { SelectorDialog } from 'app/components/Dialog';
import Graph from "app/factory/graph/graph";
import Sidebar from "app/factory/graph/sidebar";

import {
  loadData,
  type ProductId,
  type RecipeId
} from "./graph/loadJsonData";

import { ReactFlowProvider } from "@xyflow/react";
import useFactory, { useFactoryStore } from "./FactoryContext";
import RecipePicker from "./RecipePicker";
import FactoryControls from "./FactoryControls";

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

  const addNewRecipe = (recipe: AddRecipeNode) => {
    setAddRecipeNode(recipe);
  };

  const addProductToGraph = useCallback((id: RecipeId, recipeAdd: AddRecipeNode) => {

    if (!recipeAdd.productId) return;
    const newNode = {
      id: id + "_" + (new Date().getTime()),
      position: recipeAdd.position ?? { x: 100, y: 100 },
      type: "recipe-node",
      data: {
        recipeId: id,
        ltr: true,
      },
    };

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

  return (
    <>
      <div className="factoryActions flex flex-row w-full h-10 bg-black">
        <FactoryControls/>
      </div>
      <div className="flex-1 justify-self-stretch flex flex-row w-full">
        <div className="w-[25vw] resize-x overflow-x-hidden w-max-[50vw] overflow-y-scroll">
          <Sidebar addNewRecipe={addNewRecipe} />
        </div>
        <div className="flex-1">
          <div className="w-full h-full">
            <ReactFlowProvider >
              <Graph addNewRecipe={addNewRecipe} />
            </ReactFlowProvider>
          </div>
          {/* <div className="min-h-20 w-full overflow-auto">
          <FactorySwitches />
        </div> */}
        </div>
      </div>
      {addRecipeNode ? (
        <SelectorDialog widthClassName="min-w-[90vw]" title={recipeSelectorProduct?.name} isOpen={addRecipeNode !== null} setIsOpen={blankRecipeSelectorProduct}>
          <RecipePicker
            productId={addRecipeNode.productId}
            selectRecipe={(recipeId) => {
              addProductToGraph(recipeId, addRecipeNode)
            }}
            productIs={addRecipeNode.produce ? "output" : "input"} />
        </SelectorDialog>
      ) : ("")}
    </>);
}
