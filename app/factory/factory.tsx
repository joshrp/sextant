import { useCallback, useEffect, useRef, useState } from "react";
import Highs, { type Highs as HighsType } from "highs";

import { SelectorDialog } from 'app/components/Dialog';
import Graph from "app/factory/graph/graph";
import Sidebar from "app/factory/graph/sidebar";
import { type FactoryGoal } from "app/factory/solver/types";
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
import type { Solution } from "./solver/types";

const recipeData = loadRecipeData();
const machineData = loadMachineData();
const productData = loadProductData();

export type FactoryProps = {
}
export function Factory({ }: FactoryProps) {
  const { highs, loading: loadingHighs } = useHighs();
  const [calcResults, setCalcResults] = useState<Solution | null>(null);

  const factory = useFactory();
  const factorySettings = factory.settings;
  const useStore = factory.useStore;

  const addNode = useStore(state => state.addNode);

  const setNodeData = useStore(state => state.setNodeData);
  const solver = useStore(state => state.solver);
  const goals = useStore(state => state.goals);

  useEffect(() => {
    // let solver: Solver | null = null;
    if (!loadingHighs && solver) {
      console.log({
        solver,
        goals
      });
      const solution = solver.solve(highs, goals);
      // TODO Check these
      // goals.forEach(g => {
      //   if (openConnections.inputs[g.productId]) {
      //     throw new Error('One of your goal items has an unconstrained input. Cannot gurarantee output while also inputting the same item.');
      //   }
      // })      

      setCalcResults(solution);
      setNodeRunAmount(solution.nodeCounts);
    }
  }, [solver, goals]);

  const setNodeRunAmount = (results: Solution["nodeCounts"]) => {
    results?.forEach(res => setNodeData(res.nodeId, {
      solution: {
        solved: true,
        runCount: res.count
      }
    }));
  }

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
      <div className="h-full w-[20vw] resize-x overflow-x-hidden w-max-[50vw]">
        <Sidebar calcResults={calcResults} addNewRecipe={addNewRecipe} />
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

export const useHighs = () => {
  const defaultUrl = "https://lovasoa.github.io/highs-js/";

  const url = useRef('');
  const [highs, setHighs] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async (url: string) => {
    console.log("Loading Highs from", url);
    return await Highs({ locateFile: (file: string) => url + file });
  }

  useEffect(() => {
    console.log("useHighs effect", url.current, defaultUrl);
    if (url.current !== defaultUrl) {
      setLoading(true);
      url.current = defaultUrl;
      load(defaultUrl)
        .then(exports => setHighs(exports))
        .finally(() => setLoading(false))
    }
  }, [defaultUrl]);
  return { highs, loading };
}
