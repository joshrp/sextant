import { TrashIcon } from '@heroicons/react/24/outline';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/solid';
import { Position } from '@xyflow/react';
import HelpLink from '~/components/HelpLink';
import { formatNumber, machineIcon, productBackground } from '~/uiUtils';
import type { HighlightModes } from '../store';
import { HandleList, ProductHandle } from './handles';
import type { ProductId, Recipe } from './loadJsonData';
import { SettlementCalculator, type SettlementNodeData } from './recipeNodeLogic';

type ProductEdges = Map<ProductId, boolean | null>;

export interface SettlementNodeViewProps {
  recipe: Recipe;
  settlementOptions: SettlementNodeData["options"];
  setOptions: (options: SettlementNodeData["options"]) => void;
  productEdges: ProductEdges;
  ltr: boolean;
  zoomLevel: 0 | 1 | 2 | 3;
  onFlip: () => void;
  onRemove: () => void;
  solution?: {
    solved: boolean;
    runCount?: number;
  };
  highlight?: HighlightModes;
  nodeId?: string;
}

/**
 * Pure presentational component for rendering a recipe node.
 * All calculations and state management should be done by the parent component.
 */
export default function SettlementNodeView({
  recipe,
  settlementOptions,
  setOptions,
  productEdges,
  ltr,
  zoomLevel,
  onFlip,
  onRemove,
  solution,
  highlight,
  nodeId,
}: SettlementNodeViewProps) {

  console.log("Rendering SettlementNodeView", { recipe, settlementOptions, productEdges, ltr, zoomLevel, solution, highlight });
  const runCount = solution?.runCount !== undefined ? solution.runCount : 1;
  const Calculator = SettlementCalculator(recipe, settlementOptions, runCount);

  const displayRunCount = solution?.solved && solution.runCount ? solution.runCount : 1;

  const leftProducts = ltr ? recipe.inputs : recipe.outputs;
  const rightProducts = ltr ? recipe.outputs : recipe.inputs;
  const toggleSwitch = (prodId: ProductId, isInput: boolean) => () =>
    isInput ? setOptions({
      ...settlementOptions,
      inputs: {
        ...settlementOptions.inputs,
        [prodId]: !(settlementOptions.inputs[prodId]),
      }
    }) : setOptions({
      ...settlementOptions,
      outputs: {
        ...settlementOptions.outputs,
        [prodId]: !(settlementOptions.outputs[prodId]),
      }
    })

  return (
    <div
      data-zoomlevel={zoomLevel}
      className="recipe-node min-w-10 min-h-20 relative p-2 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md">
      <div className="recipe-node-title-bar flex justify-between border-white/20 mb-8 pb-2 border-b-2 items-center-safe ">
        <div className="flex-1 text-left p-1">
          <button
            title="Flip Direction"
            className="cursor-pointer text-white/50 hover:text-white/80 hover:bg-gray-500/50 p-1 rounded"
            onClick={onFlip}>
            <ArrowsRightLeftIcon className={`transition-[scale] duration-200 inline-block w-6 ${ltr ? "" : "scale-x-[-1]"}`} />
          </button>
        </div>
        <div className="flex-10 text-center text-xl flex items-center justify-center gap-2">
          <span>Settlement</span>
          {recipe.machine.isBalancer && <HelpLink topic="balancer" title="Learn about Balancers" iconSize="w-5 h-5" />}
        </div>
        <div className="flex-1 justify-end-safe text-right ">
          <button
            className="cursor-pointer text-red-500/50 hover:text-white/80 hover:bg-red-500/50 p-1 rounded"
            onClick={onRemove}>
            <TrashIcon className='w-6' />
          </button>
        </div>
      </div>

      <div className="products flex flex-row gap-2 text-xl justify-between mt-4">
        <HandleList
          pos={Position.Left}
          inputs={ltr}
        >
          {leftProducts.map(prod => {
            const isConnected = !!productEdges.get(prod.product.id);
            const productColor = productBackground(prod.product);

            return (<>
              <ProductHandle
                key={prod.product.id}
                product={prod.product}
                quantity={Calculator.productInput(prod.product.id)}
                optional={prod.optional}
                position={Position.Left}
                isInput={ltr}
                isConnected={isConnected}
                productColor={productColor}
                ltr={true}
                displayRunCount={displayRunCount}
                highlight={highlight}
                hasSwitch={true}
                switchToggle={toggleSwitch(prod.product.id, ltr)}
                switchTitle={`Toggle ${prod.product.name} Usage`}
                switchState={settlementOptions.inputs[prod.product.id]}
              />
            </>);
          })}
        </HandleList>
        <div className="recipe-machine flex-2 flex-col items-center text-center min-w-30">
          <img src={machineIcon(recipe.machine)} alt={recipe.machine.name}
            className="inline-block w-20 min-w-8 p-1 pointer-events-none
                  bg-gray-400/10 shadow-md/20 rounded-lg data-flipped:scale-x-[-1]
                  " data-flipped={ltr == false || null} />
          <div className="w-full my-1 text-2xl">{formatNumber(runCount, "", runCount < 10 ? 3 : 1)}</div>

        </div>
        <HandleList
          pos={Position.Right}
          inputs={!ltr}
        >
          {rightProducts.map(prod => {
            const isConnected = !!productEdges.get(prod.product.id);
            const productColor = productBackground(prod.product);

            return (
              <ProductHandle
                key={prod.product.id}
                product={prod.product}
                quantity={Calculator.productOutput(prod.product.id)}
                optional={prod.optional}
                position={Position.Right}
                isInput={!ltr}
                isConnected={isConnected}
                productColor={productColor}
                ltr={false}
                displayRunCount={displayRunCount}
                highlight={highlight}
                hasSwitch={true}
                switchToggle={toggleSwitch(prod.product.id, !ltr)}
                switchTitle={`Toggle ${prod.product.name} Production`}
                switchState={settlementOptions.outputs[prod.product.id]}
                nodeId={nodeId}
              />
            );
          })}
        </HandleList>

      </div>
    </div>
  );
}
