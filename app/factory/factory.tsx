import { useCallback, useEffect, useState } from "react";

import { SelectorDialog } from 'app/components/Dialog';
import Graph from "app/factory/graph/graph";
import Sidebar from "app/factory/graph/sidebar";
import { buildLpp, useHighs } from "app/factory/solver/index";
import {
  loadMachineData,
  loadProductData,
  loadRecipeData,
  type ProductId,
  type RecipeId
} from "./graph/loadJsonData";

import { useFactory } from "./FactoryProvider";
import RecipePicker from "./RecipePicker";
import { ReactFlowProvider } from "@xyflow/react";

const recipeData = loadRecipeData();
const machineData = loadMachineData();
const productData = loadProductData();

export type FactoryProps = {
}

export function Factory({ }: FactoryProps) {
  const { highs, loading: loadingHighs } = useHighs();
  const [calcResults, setCalcResults] = useState({});

  const factory = useFactory();
  const factorySettings = factory.settings;
  const useStore = factory.useStore;

  const addNode = useStore(state => state.addNode);

  const nodeConnections = useStore(state => state.nodeConnections);
  const openConnections = useStore(state => state.openConnections);
  const goals = useStore(state => state.constraints);

  useEffect(() => {
    console.log('nodeConnections changed', nodeConnections, goals);
    // let solver: Solver | null = null;
    if (!loadingHighs && nodeConnections && openConnections) {
      const lpp = buildLpp(nodeConnections, openConnections, goals);
      // solver = new Solver(highs);
      if (lpp) {
        console.log('Solving:', lpp.lpp, lpp.constraintsMap, lpp.nodeIdToLabels)
        const res = highs.solve(lpp.lpp) as any; // No idea how to do the typing on this one

        const simpleResults: { [k: string]: number } = {};
        Object.keys(res.Columns).forEach(k => { simpleResults[k] = res.Columns[k].Primal })

        const calc = {
          status: res.Status,
          items: simpleResults,
          cols: res.Columns,
        }
        setCalcResults(calc);
      }
    }
  }, [nodeConnections, goals]);

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
  }, [recipeData, factorySettings]);

  const blankRecipeSelectorProduct = (bool: boolean) => {
    setRecipeSelectorProduct(null);
  }

  return (
    <div className="h-[90vh] flex flex-row w-full" >
      <div className="h-full w-[30vw] resize-x overflow-x-hidden w-max-[50vw]">
        <Sidebar calcResults={calcResults} addNewRecipe={addNewRecipe}/>
      </div>
      <div className="flex-1 flex flex-col items-center gap-3 h-full">
        <ReactFlowProvider >
          <Graph />
        </ReactFlowProvider>
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

