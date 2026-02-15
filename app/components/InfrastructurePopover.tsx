/**
 * InfrastructurePopover component
 * 
 * Displays a popover showing infrastructure usage breakdown by machine type.
 * Shows highest users first, grouped by machine ID.
 */

import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import useFactory, { useFactoryStore } from '~/factory/FactoryContext';
import { loadData, type MachineId } from '~/factory/graph/loadJsonData';
import type { CustomNodeType } from '~/factory/graph/nodes';
import { calculateInfrastructure, type InfrastructureType } from '~/factory/infrastructure/calculations';
import type { Solution } from '~/factory/solver/types';
import { formatNumber } from '~/uiUtils';

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
  totalAmount?: number;
  /** Callback to add a producer of this infrastructure */
  addProducer?: () => void;
  producerText?: string;
}

interface MachineUsage {
  machineId: MachineId;
  machineName: string;
  amount: number;
  count: number;
  subText: string;
}

/**
 * Calculate infrastructure usage per machine from the factory graph
 */
function calculateMachineUsage(
  nodes: CustomNodeType[],
  solution: Solution | undefined,
  type: InfrastructureType
): MachineUsage[] {
  const usageByMachine = new Map<MachineId, MachineUsage>();

  nodes.forEach((node: CustomNodeType) => {
    if (node.type !== 'recipe-node') return;
    
    const recipe = node.data.type !== 'settlement' && recipes.get(node.data?.recipeId);
    if (!recipe) return;

    const runCount = node.data.solution?.solved ? node.data.solution.runCount : 1;
    const amount = calculateInfrastructure(recipe.machine, runCount, type);
    
    if (amount === 0) return;
    let subText = '';
    if (type === 'footprint' && recipe.machine.footprint) {
      subText = `(${recipe.machine.footprint[0]}x${recipe.machine.footprint[1]})`;
    }
    const existing = usageByMachine.get(recipe.machine.id);
    if (existing) {
      existing.amount += amount;
      existing.count += Math.ceil(runCount);
    } else {
      usageByMachine.set(recipe.machine.id, {
        machineId: recipe.machine.id,
        machineName: recipe.machine.name,
        amount,
        count: Math.ceil(runCount),
        subText: subText,
      });
    }
  });

  // Sort by amount descending (highest first)
  return Array.from(usageByMachine.values()).sort((a, b) => b.amount - a.amount);
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

  const machineUsages = useMemo(() => {
    return calculateMachineUsage(nodes, solution, type);
  }, [nodes, solution, type]);

  const isSolved = solutionStatus === 'Solved' || solutionStatus === 'Partial';

  return (
    <Popover className="relative">
      <PopoverButton
        className="flex gap-0.5 flex-col items-center justify-center
          text-center text-xs text-gray-400 data-zero:opacity-20 data-zero:grayscale
          cursor-pointer hover:brightness-125 focus:outline-none"
        title={name + (unit ? ` (${unit})` : '')}
      >
        <div className="h-4">
          <img src={icon} alt={name} className="h-full" />
        </div>
        <div className="text-nowrap">
          {formatNumber(totalAmount || 0, unit, 0)}
        </div>
      
      </PopoverButton>

      <PopoverPanel
        anchor="bottom"
        className="bg-gray-800 text-gray-300 border-2 border-gray-500 rounded-md shadow-lg z-1500 
          min-w-64 max-w-96 mt-2"
      >
        <div className="p-2 overflow-y-auto">
          <div className="text-sm font-bold mb-2 pb-2 border-b border-gray-600">
            {name}
          </div>
          
          {machineUsages.length === 0 ? (
            <div className="text-xs text-gray-500 italic py-2">
              No machines using {name.toLowerCase()}
            </div>
          ) : (
            <div className="space-y-2 mb-2">
              {machineUsages.map(usage => {
                const machine = machines.get(usage.machineId);
                const machineIconUrl = machine ? `/assets/buildings/${machine.id}.png` : '';
                
                return (
                  <div
                    key={usage.machineId}
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
                    <div className="text-right font-mono flex-shrink-0">
                      {isSolved ? formatNumber(usage.amount, unit, 0) : '?'}
                    </div>
                  </div>
                );
              })}
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
