import { useState, type HTMLAttributes } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/solid';
import { Position } from '@xyflow/react';
import HelpLink from '~/components/HelpLink';
import { formatNumber, formatSignedInfra, machineIcon, maintenanceIcon, maintenanceName, productBackground, uiIcon } from '~/uiUtils';
import type { HighlightModes } from '../../../context/store';
import { HandleList, ProductHandle } from '../handles';
import type { ProductId, Recipe } from '../loadJsonData';
import { getQuantityDisplay, ThermalStorageCalculator, type ThermalStorageNodeOptions } from './recipeNodeLogic';
import { type ZoneModifiers } from '~/context/zoneModifiers';
import { calculateComputingNet, calculateElectricityNet } from '~/factory/infrastructure/calculations';


type ProductEdges = Map<ProductId, boolean>;

export interface ThermalStorageNodeViewProps {
  recipe: Recipe;
  thermalStorageOptions: ThermalStorageNodeOptions;
  setOptions: (options: ThermalStorageNodeOptions) => void;
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
 * Pure presentational component for rendering a thermal storage node.
 * Shows steam + water input → steam + water output with a configurable loss slider.
 */
export default function ThermalStorageNodeView({
  recipe,
  thermalStorageOptions,
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
}: ThermalStorageNodeViewProps) {
  const runCount = solution?.runCount ?? 1;
  const displayRunCount = solution?.solved && solution.runCount !== undefined ? solution.runCount : 1;
  const committedLoss = thermalStorageOptions?.loss ?? 10;
  const [draftLoss, setDraftLoss] = useState<number | null>(null);
  const loss = draftLoss ?? committedLoss;

  const Calculator = ThermalStorageCalculator(recipe, thermalStorageOptions, 1, modifiers);

  const leftProducts = ltr ? recipe.inputs : recipe.outputs;
  const rightProducts = ltr ? recipe.outputs : recipe.inputs;

  return (
    <div
      data-zoomlevel={zoomLevel}
      className="recipe-node min-w-10 min-h-20 relative p-2 bg-gray-800 rounded-lg shadow-md">
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
          <span>{recipe.machine.name}</span>
          <HelpLink topic="thermal-storage" title="Learn about Thermal Storage" iconSize="w-5 h-5" />
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
            const isConnected = !!(ltr ? inputEdges : outputEdges).get(prod.product.id);
            const productColor = productBackground(prod.product);
            const quantity = ltr ? Calculator.productInput(prod.product.id) : Calculator.productOutput(prod.product.id);
            return (
              <ProductHandle
                key={prod.product.id}
                product={prod.product}
                quantity={quantity * runCount}
                optional={prod.optional}
                position={Position.Left}
                isInput={ltr}
                isConnected={isConnected}
                productColor={productColor}
                ltr={true}
                displayRunCount={displayRunCount}
                highlight={highlight}
                hasSwitch={false}
                nodeId={nodeId}
              />
            );
          })}
        </HandleList>

        <div className="recipe-machine flex-2 flex-col items-center text-center min-w-30">
          <img src={machineIcon(recipe.machine)} alt={recipe.machine.name}
            className="inline-block w-20 min-w-8 p-1 pointer-events-none
              bg-gray-400/10 shadow-md/20 rounded-lg data-flipped:scale-x-[-1]
              " data-flipped={ltr == false || null} />
          <div className="w-full my-1 text-2xl">{formatNumber(runCount, "", runCount < 10 ? 3 : 1)}</div>

          {/* Loss slider */}
          <div className="mt-1 px-2 text-sm">
            <label className="block text-gray-400 mb-1">
              Loss: {loss}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={loss}
              onChange={e => setDraftLoss(Number(e.target.value))}
              onMouseDown={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
              onMouseUp={e => { setOptions({ loss: Number((e.target as HTMLInputElement).value) }); setDraftLoss(null); }}
              onPointerUp={e => { setOptions({ loss: Number((e.target as HTMLInputElement).value) }); setDraftLoss(null); }}
              className="nodrag w-full cursor-pointer accent-orange-500"
            />
          </div>
        </div>

        <HandleList
          pos={Position.Right}
          inputs={!ltr}
        >
          {rightProducts.map(prod => {
            const isConnected = !!(ltr ? outputEdges : inputEdges).get(prod.product.id);
            const productColor = productBackground(prod.product);
            const quantity = ltr ? Calculator.productOutput(prod.product.id) : Calculator.productInput(prod.product.id);

            return (
              <ProductHandle
                key={prod.product.id}
                product={prod.product}
                quantity={quantity * runCount}
                optional={prod.optional}
                position={Position.Right}
                isInput={!ltr}
                isConnected={isConnected}
                productColor={productColor}
                ltr={false}
                displayRunCount={displayRunCount}
                highlight={highlight}
                hasSwitch={false}
                nodeId={nodeId}
              />
            );
          })}
        </HandleList>
      </div>
      <div className="recipe-node-infra-bar mt-2 flex justify-start align-start gap-2 border-white/20 pt-4 mb-1 pb-0 border-t-2">
        <InfrastructureIcon name="Electricity" icon={uiIcon("Electricity")}
          net={calculateElectricityNet(recipe, runCount).net}
          unit="kW" />
        <InfrastructureIcon name={`Workers (${recipe.machine.workers}) x ${Math.ceil(runCount)}`} icon={uiIcon("Worker")}
          amount={getQuantityDisplay(recipe.machine.workers, Math.ceil(runCount) /* TODO:: Is this correct? Do workers get consumed even when the building is idle */, "")} />
        <InfrastructureIcon name={maintenanceName(recipe.machine)} icon={maintenanceIcon(recipe.machine)}
          amount={getQuantityDisplay((recipe.machine.maintenance_cost?.quantity || 0) * modifiers.maintenanceConsumption, runCount, "")} />
        <InfrastructureIcon name="Computing" icon={uiIcon("Computing")}
          net={calculateComputingNet(recipe.machine, runCount).net}
          unit="TFlops" />
        <InfrastructureIcon name={`Tile Footprint (${recipe.machine.footprint?.[0]} x ${recipe.machine.footprint?.[1]}) x ${Math.ceil(runCount)}`} icon={uiIcon("Move128")} iconClassName="rotate-45 scale-120"
          amount={getQuantityDisplay(recipe.machine.footprint?.reduce((a, i) => a *= i, 1) || 0, Math.ceil(runCount), "")} />
      </div>
    </div >
  );}

function InfrastructureIcon({
  name,
  icon,
  amount,
  net,
  unit,
  iconClassName = ""
}: {
  name: string,
  icon: string,
  amount?: string,
  net?: number,
  unit?: string,
  iconClassName?: string
}) {
  // If net and unit are provided, use signed formatting
  let displayAmount = amount;
  let colorClass = '';
  let iconColourShift: HTMLAttributes<HTMLDivElement>['className'] = '';
  if (net !== undefined && unit !== undefined) {
    const formatted = formatSignedInfra(net, unit);
    displayAmount = formatted.text;

    if (formatted.color === 'green') {
      colorClass = 'text-green-600';
      iconColourShift = 'filterGreenShift';
    }
  }

  // Check if value is zero - handle various formatted cases
  const isZero = net !== undefined
    ? Math.abs(net) < 0.0001  // Use numeric check for net values
    : (displayAmount?.startsWith("0 ") || displayAmount === "0");

  return (
    <div data-zero={isZero ? true : null} className="flex-1 text-center text-xl text-gray-400 data-zero:opacity-20 data-zero:grayscale">
      <div className="h-8">
        <img src={icon} className={"h-full mx-auto " + iconColourShift + iconClassName} title={name} />
      </div>
      <div className={"text-nowrap " + colorClass}>{displayAmount}</div>
    </div>
  );
}
