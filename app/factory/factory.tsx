import { useCallback, useState } from "react";
import { CloseButton, Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'


import Sidebar from "./graph/sidebar";
import Graph from "./graph/graph";
import useStore, { type GraphStore } from "./store";
import Solver, { useHighs } from "./solver/index";

import {
  loadMachineData,
  loadProductData,
  loadRecipeData,
  type ProductId,
  type RecipeId,
} from "./graph/loadJsonData";

import RecipePicker from "./RecipePicker";
import { useShallow } from "zustand/shallow";
import FactorySummary from "./summary";
import type { Highs } from "highs";
import type { FactorySettings } from "./FactoryProvider";

let id = 1;
const getId = () => id++;

const recipeData = loadRecipeData();
const machineData = loadMachineData();
const productData = loadProductData();

const formatRecipeData = (key: RecipeId) => {
  const machine = machineData[recipeData[key].machine];
  return `${machine.name} - ${recipeData[key].name}`;
}

const formatProductData = (key: ProductId) => {
  const product = productData[key];
  const recipes = product.recipes.output.length;
  return `${product.name} (${recipes})`;
}

export type FactoryProps = {
  settings: FactorySettings;
}

export function Factory({ settings }: FactoryProps) {
  const { highs, loading: loadingHighs } = useHighs();
  let solver: Solver | null = null;
  if (!loadingHighs) {
    solver = new Solver(highs);
  }
  const addNode = useStore(state => state.addNode);
  useStore(state => state.rebuildConstraintsAction)();

  // const [isOpen, setIsOpen] = useState(false);
  const [addingNewProduct, setAddingNewProduct] = useState(false);
  const [recipeSelectorProductId, setRecipeSelectorProduct] = useState<ProductId | null>(null);
  const recipeSelectorProduct = recipeSelectorProductId ? productData[recipeSelectorProductId] : null

  const chooseRecipe = (id: ProductId) => {
    setAddingNewProduct(false);
    setRecipeSelectorProduct(id);
  };

  const selectAProduct = useCallback(() => {
    setRecipeSelectorProduct(null);
    setAddingNewProduct(true);
  }, []);
    
  const addProductToGraph = useCallback((id: RecipeId) => {
    setRecipeSelectorProduct(null);
    
    const newId = getId();
    const newNode = {
      id: newId + "",
      position: { x: newId * 100, y: newId * 100 },
      type: "recipe-node",
      data: {
        label: formatRecipeData(id),
        recipeId: id,
      },
    };

    addNode(newNode);
  }, [recipeData]);

  return (
    <div className="h-[90vh] flex flex-row w-full" >
      <div className="h-full w-[30vw] resize-x overflow-x-hidden w-max-[50vw]">
        <Sidebar selectAProduct={selectAProduct} outputs={settings?.desiredOutputs}/>
      </div>
      <div className="flex-1 flex flex-col items-center gap-3 h-full">
        <Graph />
      </div>
        {addingNewProduct ? (
          <SelectorDialog title={"Select Product to make"} isOpen={addingNewProduct} setIsOpen={setAddingNewProduct}>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(50px,4fr))] gap-2 overflow-y-auto">
                {(Object.keys(productData) as ProductId[]).map((key) => {
                  const item = productData[key];
                  return (<div key={item.id} className="">
                    <div id={"tooltip-" + item.id} role="tooltip" className="absolute z-10 invisible inline-block px-3 py-2 text-sm font-medium text-white transition-opacity duration-300 bg-gray-900 rounded-lg shadow-xs opacity-0 tooltip dark:bg-gray-700">
                      {item.name}
                      <div className="tooltip-arrow" data-popper-arrow></div>
                    </div>
                    <button
                      data-tooltip-target={"tooltip-" + item.id}
                      className="bg-transparent hover:bg-gray-500 hover:border hover:border-black-500 rounded block"
                      onClick={() => chooseRecipe(item.id)}
                    ><img src={'/assets/products/' + item.icon} alt={item.name} className="inline-block p-2" />
                    </button>
                  </div>)
                })}
              </div>
          </SelectorDialog>

        ):("")}
        {recipeSelectorProductId ? (
      <SelectorDialog title={recipeSelectorProduct?.name} isOpen={recipeSelectorProduct !== null} setIsOpen={()=>setRecipeSelectorProduct}>

          <RecipePicker
            productId={recipeSelectorProductId}
            selectRecipe={addProductToGraph}
            productIs="output" />
      </SelectorDialog>
        ) : ("")}
    </div>);
}

function SelectorDialog({ isOpen, setIsOpen, title, children }: { isOpen: boolean, setIsOpen: (open: boolean) => void, title?: string, children?: React.ReactNode }) {

  return <Dialog open={isOpen} onClose={setIsOpen} className="">
    <DialogBackdrop className="fixed inset-0 bg-gray-500/75 transition-opacity data-open:opacity-40 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in" />
    <div className="fixed flex inset-0 z-10">
      <DialogPanel className="m-auto max-h-[80vh] grid grid-rows-[min-content_1fr] min-w-20 w-[60vw] bg-gray-100 dark:bg-gray-800 transition-opacity data-open:opacity-100 data-closed:opacity-0 data-enter:duration-2000 data-enter:ease-out data-leave:duration-200 data-leave:ease-in text-center sm:items-center sm:p-0">
        <div className="w-full flex items-center justify-between mb-2 p-2 border-b-2 border-gray-300 dark:border-gray-700 relative">
          <div className="flex-1" />
          <DialogTitle className="flex-6">
            Make {title}
          </DialogTitle>
          <CloseButton className="flex-1 text-right" onClick={() => setIsOpen(false)}>
            <span className="sr-only">Close</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 inline" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </CloseButton>
        </div>
        <div className="p-2 overflow-y-auto max-h-full">
          {children}
        </div>
      </DialogPanel>
    </div>
  </Dialog>
}
