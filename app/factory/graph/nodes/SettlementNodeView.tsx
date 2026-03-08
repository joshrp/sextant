import { TrashIcon } from '@heroicons/react/24/outline';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/solid';
import { Position } from '@xyflow/react';
import HelpLink from '~/components/HelpLink';
import { type ZoneModifiers } from '~/context/zoneModifiers';
import { formatNumber, machineIcon, productBackground } from '~/uiUtils';
import type { HighlightModes } from '../../../context/store';
import { HandleList, ProductHandle } from '../handles';
import type { ProductId, Recipe, RecipeProduct } from '../loadJsonData';
import { SettlementCalculator, isOptionEnabled, type SettlementNodeData } from './recipeNodeLogic';
import { CATEGORY_INFO, groupProductsByCategory, isFoodCategory } from '../settlementCategories';

type ProductEdges = Map<ProductId, boolean>;

export interface SettlementNodeViewProps {
  recipe: Recipe;
  settlementOptions: SettlementNodeData["options"];
  setOptions: (options: SettlementNodeData["options"]) => void;
  inputEdges: ProductEdges;
  outputEdges: ProductEdges;
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
  modifiers: ZoneModifiers;
}

/**
 * Category header component for separating product groups
 */
function CategoryHeader({ label }: { label: string; isFood?: boolean }) {
  return (
    <div className={`settlement-category-header text-md uppercase tracking-wide font-semibold 
      mt-6 mx-2 first:mt-0 border-b border-gray-300/30 pb-1`}>
      {label}
    </div>
  );
}

/**
 * Pure presentational component for rendering a settlement node.
 * Inputs are organized into categories: Utilities, Commodities, Health, and Food
 * (with Food subdivided into Carbs, Protein, Vitamins, and Treats).
 */
export default function SettlementNodeView({
  recipe,
  settlementOptions,
  setOptions,
  inputEdges,
  outputEdges,
  ltr,
  zoomLevel,
  onFlip,
  onRemove,
  solution,
  highlight,
  nodeId,
  modifiers,
}: SettlementNodeViewProps) {

  const runCount = solution?.runCount !== undefined ? solution.runCount : 1;
  const Calculator = SettlementCalculator(recipe, settlementOptions, runCount, modifiers);

  const displayRunCount = solution?.solved && solution.runCount ? solution.runCount : 1;

  const rightProducts = ltr ? recipe.outputs : recipe.inputs;
  const toggleOption = (
    map: Partial<Record<ProductId, boolean>>,
    id: ProductId,
  ): Partial<Record<ProductId, boolean>> => ({
    ...map,
    [id]: isOptionEnabled(map, id) ? false : true,
  });

  const toggleSwitch = (prodId: ProductId, isInput: boolean) => () =>
    setOptions({
      ...settlementOptions,
      ...(isInput
        ? { inputs: toggleOption(settlementOptions.inputs, prodId) }
        : { outputs: toggleOption(settlementOptions.outputs, prodId) }),
    });

  // Group inputs by category
  const inputGroups = groupProductsByCategory(recipe.inputs);

  const renderProductHandle = (prod: RecipeProduct, position: Position, isInput: boolean) => {
    const isConnected = !!(isInput ? inputEdges : outputEdges).get(prod.product.id);
    const productColor = productBackground(prod.product);

    return (
      <ProductHandle
        key={prod.product.id}
        product={prod.product}
        quantity={isInput ? Calculator.productInput(prod.product.id) : Calculator.productOutput(prod.product.id)}
        optional={prod.optional}
        position={position}
        isInput={isInput}
        isConnected={isConnected}
        productColor={productColor}
        ltr={position === Position.Left}
        displayRunCount={displayRunCount}
        highlight={highlight}
        hasSwitch={true}
        switchToggle={toggleSwitch(prod.product.id, isInput)}
        switchTitle={`Toggle ${prod.product.name} ${isInput ? 'Usage' : 'Production'}`}
        switchState={isInput ? isOptionEnabled(settlementOptions.inputs, prod.product.id) : isOptionEnabled(settlementOptions.outputs, prod.product.id)}
        nodeId={nodeId}
      />
    );
  };

  const renderCategorizedInputs = () => {
    const elements: React.ReactNode[] = [];
    
    for (const [category, products] of inputGroups) {
      const categoryInfo = CATEGORY_INFO[category];
      const isFood = isFoodCategory(category);
      
      elements.push(
        <CategoryHeader 
          key={`header-${category}`} 
          label={categoryInfo.label} 
          isFood={isFood} 
        />
      );
      
      elements.push(
        ...products.map(prod => renderProductHandle(prod, Position.Left, ltr))
      );
    }
    
    return elements;
  };

  return (
    <div
      data-zoomlevel={zoomLevel}
      className="recipe-node settlement-node min-w-10 min-h-20 relative p-2 bg-gray-800 rounded-lg shadow-md">
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
          <span className="tracking-wide font-semibold text-3xl">Settlement</span>
          <HelpLink topic="settlements" title="Settlements" iconSize="w-10" />
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
          {ltr ? renderCategorizedInputs() : rightProducts.map(prod => renderProductHandle(prod, Position.Left, false))}
        </HandleList>
        <div className="recipe-machine flex-2 flex-col items-center text-center min-w-30 mx-8">
          <img src={machineIcon(recipe.machine)} alt={recipe.machine.name}
            className="inline-block w-50 min-w-8 p-1 pointer-events-none
                  bg-gray-400/10 shadow-md/20 rounded-lg data-flipped:scale-x-[-1]
                  " data-flipped={ltr == false || null} />
          <div className="w-full my-1 text-2xl">{formatNumber(runCount, "", runCount < 10 ? 3 : 1)}</div>

        </div>
        <HandleList
          pos={Position.Right}
          inputs={!ltr}
        >
          {ltr ? rightProducts.map(prod => renderProductHandle(prod, Position.Right, false)) : renderCategorizedInputs()}
        </HandleList>

      </div>
    </div>
  );
}
