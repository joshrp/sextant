import { type HTMLAttributes } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/solid';
import { Position } from '@xyflow/react';
import HelpLink from '~/components/HelpLink';
import { formatSignedInfra, machineIcon, maintenanceIcon, maintenanceName, productBackground, uiIcon } from '~/uiUtils';
import type { HighlightModes } from '../../../context/store';
import { HandleList, ProductHandle } from '../handles';
import { ProductId, type Recipe } from '../loadJsonData';
import { getQuantityDisplay, minLevelForOutput, SpaceStationCalculator, type SpaceStationNodeOptions } from './recipeNodeLogic';
import type { FactoryGoal } from '~/factory/solver/types';
import { type ZoneModifiers } from '~/context/zoneModifiers';
import { calculateComputingNet, calculateElectricityNet } from '~/factory/infrastructure/calculations';

type ProductEdges = Map<ProductId, boolean>;

const RP_PRODUCT_ID = ProductId('Product_Virtual_SpaceResearchPoints');

export interface SpaceStationNodeViewProps {
  recipe: Recipe;
  spaceStationOptions: SpaceStationNodeOptions | undefined;
  setOptions: (options: SpaceStationNodeOptions) => void;
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
  /** All factory goals; used to show a goal-mismatch warning on the node
   *  when the station can't meet an RP goal at its current level. */
  goals: FactoryGoal[];
}

/**
 * Pure presentational component for rendering a space-station node.
 * Per-level inputs/outputs resolve through SpaceStationCalculator; the level
 * is set by the user via the +/- stepper. Top-level recipe.inputs are stubs
 * (qty=0) for handle stability — never read them directly.
 */
export default function SpaceStationNodeView({
  recipe,
  spaceStationOptions,
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
  goals,
}: SpaceStationNodeViewProps) {
  const runCount = solution?.runCount ?? 1;
  const displayRunCount = solution?.solved && solution.runCount !== undefined ? solution.runCount : 1;

  const regimes = recipe.levelRegimes ?? [];
  const minLevel = regimes.length > 0 ? regimes[0].minLevel : 1;
  const maxLevel = regimes.length > 0 ? regimes[regimes.length - 1].maxLevel : 100;
  const level = spaceStationOptions?.level ?? recipe.defaultLevel ?? minLevel;
  const setLevel = (next: number) => {
    setOptions({ level: Math.max(minLevel, Math.min(maxLevel, next)) });
  };

  const Calculator = SpaceStationCalculator(recipe, spaceStationOptions, 1, modifiers);

  // Goal-mismatch warning: when an RP goal can't be met at the current level
  // (or — for `eq` goals — is overshot), surface a clickable hint with the
  // minimum level that would satisfy.
  const rpGoal = goals.find(g => g.productId === RP_PRODUCT_ID);
  const producedRP = Calculator.productOutput(RP_PRODUCT_ID);
  let goalWarning: { message: string; bumpTo?: number } | undefined;
  if (rpGoal !== undefined) {
    if ((rpGoal.type === 'gt' || rpGoal.type === 'eq') && producedRP < rpGoal.qty) {
      const bumpTo = minLevelForOutput(recipe, RP_PRODUCT_ID, rpGoal.qty);
      goalWarning = bumpTo !== undefined
        ? { message: `Goal needs L${bumpTo}`, bumpTo }
        : { message: `Goal exceeds max output` };
    } else if (rpGoal.type === 'eq' && producedRP > rpGoal.qty) {
      goalWarning = { message: `Goal overshot — lower the level` };
    }
  }

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
          <HelpLink topic="space-research" title="Learn about Space Research" iconSize="w-5 h-5" />
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
        <HandleList pos={Position.Left} inputs={ltr}>
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
          <div className="w-full my-1 text-xl flex items-center justify-center gap-1">
            <button
              className="cursor-pointer w-6 h-6 leading-none rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30"
              disabled={level <= minLevel}
              onClick={() => setLevel(level - 1)}
              title="Lower level"
            >−</button>
            <span className="px-2 min-w-16 text-center">Level {level}</span>
            <button
              className="cursor-pointer w-6 h-6 leading-none rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30"
              disabled={level >= maxLevel}
              onClick={() => setLevel(level + 1)}
              title="Raise level"
            >+</button>
          </div>
          {goalWarning && (
            goalWarning.bumpTo !== undefined ? (
              <button
                onClick={() => setLevel(goalWarning.bumpTo!)}
                title={`Set level to ${goalWarning.bumpTo}`}
                className="cursor-pointer mt-1 text-xs px-2 py-0.5 rounded border border-amber-500/60 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
              >
                ⚠ {goalWarning.message} ↑
              </button>
            ) : (
              <div
                className="mt-1 text-xs px-2 py-0.5 rounded border border-amber-500/60 text-amber-300 bg-amber-500/10"
                title="Adjust the goal or maxLevel to resolve"
              >
                ⚠ {goalWarning.message}
              </div>
            )
          )}
        </div>

        <HandleList pos={Position.Right} inputs={!ltr}>
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
        <InfrastructureIcon name={`Workers (${Calculator.workers()}) x ${Math.ceil(runCount)}`} icon={uiIcon("Worker")}
          amount={getQuantityDisplay(Calculator.workers(), Math.ceil(runCount), "")} />
        <InfrastructureIcon name={maintenanceName(recipe.machine)} icon={maintenanceIcon(recipe.machine)}
          amount={getQuantityDisplay((recipe.machine.maintenance_cost?.quantity || 0) * modifiers.maintenanceConsumption, runCount, "")} />
        <InfrastructureIcon name="Computing" icon={uiIcon("Computing")}
          net={calculateComputingNet(recipe.machine, runCount).net}
          unit="TFlops" />
        <InfrastructureIcon name={`Tile Footprint (${recipe.machine.footprint?.[0]} x ${recipe.machine.footprint?.[1]}) x ${Math.ceil(runCount)}`} icon={uiIcon("Move128")} iconClassName="rotate-45 scale-120"
          amount={getQuantityDisplay(recipe.machine.footprint?.reduce((a, i) => a *= i, 1) || 0, Math.ceil(runCount), "")} />
      </div>
    </div>
  );
}

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
  const isZero = net !== undefined
    ? Math.abs(net) < 0.0001
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
