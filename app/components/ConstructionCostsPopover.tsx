import { Disclosure, DisclosureButton, DisclosurePanel, Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { ChevronRightIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/solid';
import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import useFactory, { useFactoryStore } from '~/context/FactoryContext';
import { loadData } from '~/factory/graph/loadJsonData';
import { calculateConstructionCosts, type ConstructionCostSummary } from '~/factory/infrastructure/constructionCosts';
import { formatNumber, machineIcon as getMachineIcon, productIcon } from '~/uiUtils';

const { machines } = loadData();

export default function ConstructionCostsPopover() {
  const nodes = useFactory().store.getState().nodes;
  const solution = useFactoryStore(useShallow(state => state.solution));
  const solutionStatus = useFactoryStore(useShallow(state => state.solutionStatus));

  const costs: ConstructionCostSummary = useMemo(() => {
    return calculateConstructionCosts(nodes);
  }, [nodes, solution]);

  const isSolved = solutionStatus === 'Solved' || solutionStatus === 'Partial';
  const hasData = costs.totals.length > 0;

  return (
    <Popover className="relative">
      <PopoverButton
        className="flex gap-0.5 flex-col items-center justify-center
          text-center text-xs text-gray-400
          cursor-pointer hover:brightness-125 focus:outline-none"
        title="Construction Costs"
      >
        <div className="h-4">
          <WrenchScrewdriverIcon className="h-full w-4 text-gray-400" />
        </div>
        <div className="text-nowrap">
          Build Cost
        </div>
      </PopoverButton>

      <PopoverPanel
        anchor="bottom"
        className="bg-gray-800 text-gray-300 border-2 border-gray-500 rounded-md shadow-lg z-1500
          min-w-72 max-w-96 mt-2"
      >
        <div className="p-2 overflow-y-auto max-h-96">
          <div className="text-sm font-bold mb-2 pb-2 border-b border-gray-600">
            Construction Costs
          </div>

          {!hasData ? (
            <div className="text-xs text-gray-500 italic py-2">
              No machines with build costs
            </div>
          ) : (
            <div className="space-y-3">
              {/* Totals Section */}
              <div>
                <div className="text-xs font-semibold text-gray-300 mb-1.5">
                  Total Materials Needed
                </div>
                <div className="space-y-1.5">
                  {costs.totals.map(entry => (
                    <div
                      key={entry.product.id}
                      className="flex items-center gap-2 text-xs"
                    >
                      <img
                        src={productIcon(entry.product.icon)}
                        alt={entry.product.name}
                        className="w-6 h-6 shrink-0"
                      />
                      <div className="flex-1 min-w-0 truncate">
                        {entry.product.name}
                      </div>
                      <div className="text-right font-mono shrink-0 text-amber-300">
                        {isSolved ? formatNumber(entry.quantity, '', 0) : '?'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-machine Breakdown */}
              {costs.machines.length > 0 && (
                <Disclosure>
                  <DisclosureButton className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-200 cursor-pointer w-full pt-2 border-t border-gray-600">
                    <ChevronRightIcon className="w-3 h-3 transition-transform ui-open:rotate-90 data-open:rotate-90" />
                    Per Machine Breakdown
                  </DisclosureButton>
                  <DisclosurePanel className="space-y-2 mt-2">
                    {costs.machines.map(machine => {
                      const machineData = machines.get(machine.machineId);
                      const machineIconUrl = machineData ? getMachineIcon(machineData) : '';

                      return (
                        <div
                          key={machine.machineId}
                          className="flex items-start gap-2 text-xs"
                        >
                          <img
                            src={machineIconUrl}
                            alt={machine.machineName}
                            className="w-8 h-8 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">
                              {machine.machineName}
                              <span className="text-gray-500 font-normal ml-1">
                                x{machine.buildingCount}
                              </span>
                            </div>
                            <div className="text-gray-400 mt-0.5">
                              {machine.costs.map((cost, i) => (
                                <span key={cost.product.id}>
                                  {i > 0 && ', '}
                                  {isSolved ? formatNumber(cost.quantity, '', 0) : '?'}
                                  {' '}
                                  <img
                                    src={productIcon(cost.product.icon)}
                                    alt={cost.product.name}
                                    title={cost.product.name}
                                    className="w-4 h-4 inline-block align-text-bottom"
                                  />
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </DisclosurePanel>
                </Disclosure>
              )}
            </div>
          )}
        </div>
      </PopoverPanel>
    </Popover>
  );
}
