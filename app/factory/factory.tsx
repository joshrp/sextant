import { useCallback, useEffect, useState } from "react";

import { SelectorDialog } from 'app/components/Dialog';
import Graph from "app/factory/graph/graph";
import Sidebar from "app/factory/graph/sidebar";
import { buildLpp, useHighs, type FactoryGoal } from "app/factory/solver/index";
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

export type Solution = {
  status: "Solved" | "Infeasible" | "Error",
  errorMessage?: string,
  goals?: {
    goal: FactoryGoal,
    resultCount: number,
  }[],
  products?: {
    inputs: { productId: ProductId, amount: number }[]
    outputs: { productId: ProductId, amount: number }[]
  },
  nodeCounts?: { nodeId: string, count: number }[]
  freeableConstraints?: {
    id: string,
    product: ProductId,
  }[]
}

export type FactoryProps = {
}
const nodeLabelMatcher = /^n_\d+/;
const inputMatcher = /^i_(.+)$/;
const outputMatcher = /^o_(.+)$/;
export function Factory({ }: FactoryProps) {
  const { highs, loading: loadingHighs } = useHighs();
  const [calcResults, setCalcResults] = useState<Solution | null>(null);

  const factory = useFactory();
  const factorySettings = factory.settings;
  const useStore = factory.useStore;

  const addNode = useStore(state => state.addNode);

  const setNodeData = useStore(state => state.setNodeData);
  const nodeConnections = useStore(state => state.nodeConnections);
  const openConnections = useStore(state => state.openConnections);
  const goals = useStore(state => state.constraints);

  useEffect(() => {
    // let solver: Solver | null = null;
    if (!loadingHighs && nodeConnections && openConnections) {
      console.log('Running Builder');
      console.log({
        nodeConnections,
        openConnections,
        goals
      });
      const lpp = buildLpp(nodeConnections, openConnections, goals);
      goals.forEach(g => {
        if (openConnections.inputs[g.productId]) {
          throw new Error('One of your goal items has an unconstrained input. Cannot gurarantee output while also inputting the same item.');
        }
      })
      if (lpp) {
        console.log('Running Solver:', lpp)
        console.log('LPP:', lpp.lpp)
        let res: ReturnType<typeof highs.solve> | null = null;
        try {
          res = highs.solve(lpp.lpp); // No idea how to do the typing on this one
        } catch (e) {
          console.error('Error solving LPP');
          console.error(e);
        }

        if (res == null) {
          setCalcResults({
            status: "Error",
            errorMessage: lpp.lpp
          })
          return;
        };
        console.log(res);
        const nodeResults: Solution["nodeCounts"] = [];
        const productResults: Solution["products"] = { inputs: [], outputs: [] };
        Object.keys(res.Columns).forEach(k => {
          const nodeLabel = k.match(nodeLabelMatcher)?.[0]
          if (nodeLabel) {
            const node = Object.keys(lpp.nodeIdToLabels).find(l => lpp.nodeIdToLabels[l] == nodeLabel);
            if (node) nodeResults.push({
              nodeId: node,
              count: res.Columns[nodeLabel].Primal,
            });
          }

          const outputLabel = k.match(outputMatcher)?.[1]
          if (outputLabel)
            productResults?.outputs.push({
              productId: outputLabel,
              amount: res.Columns[k].Primal
            });

          const inputLabel = k.match(inputMatcher)?.[1]
          if (inputLabel)
            productResults?.inputs.push({
              productId: inputLabel,
              amount: res.Columns[k].Primal
            });
        })

        const calc: Solution = {
          status: res.Status,
          errorMessage: '',
          goals: goals.map(goal => {
            const columnPrefix = goal.dir == "input" ? "i" : "o";
            return {
              goal,
              resultCount: res.Columns[columnPrefix + "_" + goal.productId]
            };
          }),
          products: productResults,
          nodeCounts: nodeResults,
          freeableConstraints: [], // TODO
        }

        setCalcResults(calc);
        setNodeRunAmount(nodeResults);
      }
    }
  }, [nodeConnections, goals]);

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

