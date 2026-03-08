import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { useMemo, type HTMLAttributes } from 'react';
import { useShallow } from 'zustand/shallow';
import useFactory, { useFactoryStore } from '~/context/FactoryContext';
import { loadData, type MachineId } from '~/factory/graph/loadJsonData';
import type { CustomNodeType } from '~/factory/graph/nodes';
import { calculateInfrastructureNet, type InfrastructureType } from '~/factory/infrastructure/calculations';
import type { Solution } from '~/factory/solver/types';
import { formatNumber, formatSignedInfra, machineIcon as getMachineIcon } from '~/uiUtils';

const { recipes, machines } = loadData();

export interface InfrastructurePopoverProps {
  /** The infrastructure type to show usage for */
  type: InfrastructureType;
  /** Icon to show in the button */
  icon: string;
  /** Name of the infrastructure type */
  name: string;
  /** Unit for display (e.g., "kW", "TFlops") */
  unit?: string;
  /** Total amount (shown in button) */
  totalAmount: number;
  /** Callback to add a producer of this infrastructure */
  addProducer?: () => void;
  producerText?: string;
}

interface MachineUsage {
  machineId: MachineId;
  machineName: string;
  consumed: number;
  generated: number;
  net: number;
  count: number;
  subText: string;
}

/**
 * Calculate infrastructure usage per machine from the factory graph
 * Returns both consumers and producers separately
 */
function calculateMachineUsage(
  nodes: CustomNodeType[],
  solution: Solution | undefined,
  type: InfrastructureType
): { consumers: MachineUsage[], producers: MachineUsage[] } {
  const usageByMachine = new Map<MachineId, MachineUsage>();

  nodes.forEach((node: CustomNodeType) => {
    if (node.type !== 'recipe-node') return;

    const recipe = node.data.type !== 'settlement' && recipes.get(node.data?.recipeId);
    if (!recipe) return;

    const runCount = node.data.solution?.solved ? node.data.solution.runCount : 1;
    const netInfra = calculateInfrastructureNet(recipe.machine, runCount, type);

    if (netInfra.consumed === 0 && netInfra.generated === 0) return;

    let subText = '';
    if (type === 'footprint' && recipe.machine.footprint) {
      subText = `(${recipe.machine.footprint[0]}x${recipe.machine.footprint[1]})`;
    }

    const existing = usageByMachine.get(recipe.machine.id);
    if (existing) {
      existing.consumed += netInfra.consumed;
      existing.generated += netInfra.generated;
      existing.net += netInfra.net;
      existing.count += Math.ceil(runCount);
    } else {
      usageByMachine.set(recipe.machine.id, {
        machineId: recipe.machine.id,
        machineName: recipe.machine.name,
        consumed: netInfra.consumed,
        generated: netInfra.generated,
        net: netInfra.net,
        count: Math.ceil(runCount),
        subText: subText,
      });
    }
  });

  const allUsages = Array.from(usageByMachine.values());

  // Split into consumers and producers
  const consumers = allUsages.filter(u => u.consumed > 0).sort((a, b) => b.consumed - a.consumed);
  const producers = allUsages.filter(u => u.generated > 0).sort((a, b) => b.generated - a.generated);

  return { consumers, producers };
}

export default function InfrastructurePopover({
  type,
  icon,
  name,
  unit,
  totalAmount,
  producerText = "Add Producer",
  addProducer,
}: InfrastructurePopoverProps) {
  const nodes = useFactory().store.getState().nodes;
  const solution = useFactoryStore(useShallow(state => state.solution));
  const solutionStatus = useFactoryStore(useShallow(state => state.solutionStatus));

  const { consumers, producers } = useMemo(() => {
    return calculateMachineUsage(nodes, solution, type);
  }, [nodes, solution, type]);

  const isSolved = solutionStatus === 'Solved' || solutionStatus === 'Partial';
  const hasData = consumers.length > 0 || producers.length > 0;

  let colorClass = '';
  let iconColourShift: HTMLAttributes<HTMLDivElement>['className'] = '';
  const formatted = formatSignedInfra(totalAmount, unit || '');
  const displayAmount = formatted.text;

  if (formatted.color === 'green') {
    colorClass = 'text-green-600';
    iconColourShift = 'filterGreenShift';
  }

return (
  <Popover className="relative">
    <PopoverButton
      className="flex gap-0.5 flex-col items-center justify-center
          text-center text-xs text-gray-400 data-zero:opacity-20 data-zero:grayscale
          cursor-pointer hover:brightness-125 focus:outline-none"
      title={name + (unit ? ` (${unit})` : '')}
    >
      <div className="h-4">
        <img src={icon} alt={name} className={`h-full ${iconColourShift}`} />
      </div>
      <div className={`text-nowrap ${colorClass}`}>
        {displayAmount}
      </div>

    </PopoverButton>

    <PopoverPanel
      anchor="bottom"
      className="bg-gray-800 text-gray-300 border-2 border-gray-500 rounded-md shadow-lg z-1500 
          min-w-64 max-w-96 mt-2"
    >
      <div className="p-2 overflow-y-auto max-h-96">
        <div className="text-sm font-bold mb-2 pb-2 border-b border-gray-600">
          {name}
        </div>

        {!hasData ? (
          <div className="text-xs text-gray-500 italic py-2">
            No machines using or producing {name.toLowerCase()}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Producers Section */}
            {producers.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-green-400 mb-1.5">
                  Producers
                </div>
                <div className="space-y-2">
                  {producers.map(usage => {
                    const machine = machines.get(usage.machineId);
                    const machineIconUrl = machine ? getMachineIcon(machine) : '';

                    return (
                      <div
                        key={`producer-${usage.machineId}`}
                        className="flex items-center gap-2 text-xs"
                      >
                        <img
                          src={machineIconUrl}
                          alt={usage.machineName}
                          className="w-8 h-8 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{usage.machineName}</div>
                          <div className="text-gray-500 text-xs">
                            {usage.count} {usage.count === 1 ? 'building' : 'buildings'} {usage.subText}
                          </div>
                        </div>
                        <div className="text-right font-mono flex-shrink-0 text-green-400">
                          {isSolved ? `+${formatNumber(usage.generated, '', 0)}` : '?'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Consumers Section */}
            {consumers.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-amber-400 mb-1.5">
                  Consumers
                </div>
                <div className="space-y-2">
                  {consumers.map(usage => {
                    const machine = machines.get(usage.machineId);
                    const machineIconUrl = machine ? getMachineIcon(machine) : '';

                    return (
                      <div
                        key={`consumer-${usage.machineId}`}
                        className="flex items-center gap-2 text-xs"
                      >
                        <img
                          src={machineIconUrl}
                          alt={usage.machineName}
                          className="w-8 h-8 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{usage.machineName}</div>
                          <div className="text-gray-500 text-xs">
                            {usage.count} {usage.count === 1 ? 'building' : 'buildings'} {usage.subText}
                          </div>
                        </div>
                        <div className="text-right font-mono flex-shrink-0 text-amber-400">
                          {isSolved ? `-${formatNumber(usage.consumed, '', 0)}` : '?'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Net Total */}
            {isSolved && totalAmount !== undefined && (
              <div className="pt-2 border-t border-gray-600">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Net Total:</span>
                  <span className={totalAmount > 0 ? 'text-amber-400' : totalAmount < 0 ? 'text-green-400' : ''}>
                    {formatSignedInfra(totalAmount, '').text}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {addProducer && (
        <button onClick={addProducer}
          className="block m-1 p-2 mx-auto cursor-pointer bg-blue-600 hover:brightness-125 text-white text-xs rounded"
        >
          {producerText}
        </button>
      )}
    </PopoverPanel>
  </Popover>
);
}
