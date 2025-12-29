import { TrashIcon } from '@heroicons/react/24/outline';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/solid';
import { Handle, Position } from '@xyflow/react';
import { formatNumber, machineIcon, maintenanceIcon, maintenanceName, productBackground, productIcon, uiIcon } from '~/uiUtils';
import type { Recipe, ProductId } from './loadJsonData';
import type { ButtonEdge } from './edges/ButtonEdge';
import { getQuantityDisplay } from './recipeNodeLogic';

const handleStyle: React.CSSProperties = { 
  width: "auto", 
  height: "auto", 
  position: "initial", 
  transform: "initial", 
  border: 'none', 
  backgroundColor: 'transparent' 
};

type ProductEdges = Map<ProductId, ButtonEdge | null>;

export interface RecipeNodeViewProps {
  recipe: Recipe;
  runCount: number;
  productEdges: ProductEdges;
  ltr: boolean;
  isFarZoom: boolean;
  onFlip: () => void;
  onRemove: () => void;
  solution?: {
    solved: boolean;
    runCount?: number;
  };
}

/**
 * Pure presentational component for rendering a recipe node.
 * All calculations and state management should be done by the parent component.
 */
export default function RecipeNodeView({
  recipe,
  runCount,
  productEdges,
  ltr,
  isFarZoom,
  onFlip,
  onRemove,
  solution,
}: RecipeNodeViewProps) {
  return (
    <div className="recipe-node min-w-10 min-h-20 relative p-2 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md">
      <div className="recipe-node-title-bar flex justify-between border-white/20 mb-8 pb-2 border-b-2 items-center-safe ">
        <div className="flex-1 text-left p-1">
          <button
            title="Flip Direction"
            className="cursor-pointer text-white/50 hover:text-white/80 hover:bg-gray-500/50 p-1 rounded"
            onClick={onFlip}>
            <ArrowsRightLeftIcon className={`transition-[scale] duration-200 inline-block w-6 ${ltr ? "" : "scale-x-[-1]"}`} />
          </button>
        </div>
        <div className="flex-10 text-center text-xl">{recipe.machine.name}</div>
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
          products={ltr ? recipe.inputs : recipe.outputs}
          pos={Position.Left} 
          inputs={ltr} 
          productEdges={productEdges}
          solution={solution}
        />
        {!isFarZoom &&
          <div className="recipe-machine flex-2 flex-col items-center text-center min-w-30">
            <img src={machineIcon(recipe.machine)} alt={recipe.machine.name}
              className="inline-block w-20 min-w-8 p-1 pointer-events-none
          bg-gray-400/10 shadow-md/20 rounded-lg data-flipped:scale-x-[-1]
          " data-flipped={ltr == false || null} />
            <div className="w-full my-1 text-2xl">{formatNumber(runCount, "", runCount < 10 ? 3 : 1)}</div>

          </div>
        }
        <HandleList 
          products={ltr ? recipe.outputs : recipe.inputs}
          pos={Position.Right} 
          inputs={!ltr} 
          productEdges={productEdges}
          solution={solution}
        />

      </div>
      <div className="recipe-node-infra-bar flex justify-start align-start gap-2 border-white/20 pt-4 mb-1 pb-0 border-t-2">
        <InfrastructureIcon name="Electricity Used" icon={uiIcon("Electricity")}
          amount={getQuantityDisplay(recipe.machine.electricity_consumed, runCount, "kW") /*TODO:: Modify by recipe? */} />
        <InfrastructureIcon name={`Workers (${recipe.machine.workers}) x ${Math.ceil(runCount)}`} icon={uiIcon("Worker")}
          amount={getQuantityDisplay(recipe.machine.workers, Math.ceil(runCount) /* TODO:: Is this correct? Do workers get consumed even when the building is idle */, "")} />
        <InfrastructureIcon name={maintenanceName(recipe.machine)} icon={maintenanceIcon(recipe.machine)}
          amount={getQuantityDisplay(recipe.machine.maintenance_cost?.quantity || 0, runCount, "")} />
        <InfrastructureIcon name="Computing Used" icon={uiIcon("Computing")}
          amount={getQuantityDisplay(recipe.machine.computing_consumed, runCount, "TFlops")} />
        <InfrastructureIcon name={`Tile Footprint (${recipe.machine.footprint?.[0]} x ${recipe.machine.footprint?.[1]}) x ${Math.ceil(runCount)}`} icon={uiIcon("Move128")} iconClassName="rotate-45 scale-120"
          amount={getQuantityDisplay(recipe.machine.footprint?.reduce((a, i) => a *= i, 1) || 0, Math.ceil(runCount), "")} />
      </div>
    </div>
  );
}

function InfrastructureIcon({ name, icon, amount, iconClassName }: { name: string, icon: string, amount: string, iconClassName?: string }) {
  return (
    <div data-zero={amount.startsWith("0 ") ? true : null} className="flex-1 text-center text-xl text-gray-400 data-zero:opacity-20 data-zero:grayscale">
      <div className="h-8">
        <img src={icon} className={"h-full mx-auto " + iconClassName} title={name} />
      </div>
      <div className="text-nowrap">{amount}</div>
    </div>
  );
}

type HandleListProps = {
  products: Recipe["inputs" | "outputs"],
  pos: Position,
  inputs: boolean
  productEdges: ProductEdges
  solution?: {
    solved: boolean;
    runCount?: number;
  };
}

function HandleList({ products, pos, inputs, productEdges, solution }: HandleListProps) {
  const ltr = <T extends string, U extends string>(left: T, right: U) => pos === Position.Left ? left : right;
  const inOrOut = <T extends string, U extends string>(input: T, output: U) => inputs ? input : output;

  return (
    <div className={
      `recipe-${inOrOut("inputs", "outputs")} 
        recipe-list
        flex-2 relative 
        ${ltr("items-start -left-2", "justify-end-safe -right-2")}`
    }>
      {products.map(prod => {
        const isConnected = productEdges.get(prod.product.id) !== null;
        const productColor = productBackground(prod.product);
        const displayRunCount = solution?.solved && solution.runCount ? solution.runCount : 1;

        const handle = <Handle type={inOrOut("target", "source")}
          position={pos}
          id={prod.product.id}
          style={handleStyle}
          className="handle py-2 text-center">
          <img data-optional={prod.optional ? true : null} src={productIcon(prod.product.icon)} alt={prod.product.name}
            className="drop-shadow-md/30 pointer-events-none block max-w-8 
            data-optional:p-0.5 data-optional:box-content data-optional:border-1 border-dashed border-gray-400 border-0
          " />
          <div
            style={{
              backgroundColor: productColor,
              borderColor: productColor,
            }}
            className={"clipped hidden pointer-events-none w-6 top-0 h-[101%] absolute border-1 " + ltr("-left-5", "-right-5") + " " + inOrOut(ltr("", "scale-x-[-1]"), ltr("scale-x-[-1]", ""))}
          ></div>
        </Handle>

        return (<div style={{ backgroundColor: productColor }}
          className={`recipe-${inOrOut("input", "output")} recipe-handle text-nowrap relative ${ltr("pl-2", "pr-2")} flex mb-4 items-center-safe`}
          key={prod.product.id}
          data-connected={isConnected}
        >
          {pos === Position.Left ? handle : null}
          <div className="flex-1 min-w-4 p-2 text-shadow-md/50">
            {getQuantityDisplay(prod.quantity, displayRunCount, prod.product.unit)}
          </div>
          {pos === Position.Left ? null : handle}
        </div>);
      })}
    </div>
  );
}
