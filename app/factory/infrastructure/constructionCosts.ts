/**
 * Construction cost calculation utilities
 *
 * Aggregates the material costs required to build all machines in a factory.
 * Informational only — not part of the solver objective.
 */

import type { CustomNodeType } from '../graph/nodes';
import { loadData, type MachineId, type Product, type ProductId } from '../graph/loadJsonData';

const { recipes } = loadData();

export type ConstructionCostEntry = { product: Product; quantity: number };

export type MachineCostEntry = {
  machineId: MachineId;
  machineName: string;
  buildingCount: number;
  costs: ConstructionCostEntry[];
};

export type ConstructionCostSummary = {
  /** Total cost per product across all machines */
  totals: ConstructionCostEntry[];
  /** Per-machine breakdown */
  machines: MachineCostEntry[];
};

/**
 * Calculate total construction costs from all recipe nodes in the graph.
 *
 * For each recipe node with a solution, looks up the recipe's machine buildCosts,
 * multiplies each cost entry by `Math.ceil(runCount)`, and aggregates across
 * all nodes by ProductId.
 */
export function calculateConstructionCosts(nodes: CustomNodeType[]): ConstructionCostSummary {
  const totalsByProduct = new Map<ProductId, { product: Product; quantity: number }>();
  const machineAgg = new Map<MachineId, MachineCostEntry>();

  for (const node of nodes) {
    if (node.type !== 'recipe-node') continue;
    if (node.data.type === 'settlement') continue;

    const recipe = recipes.get(node.data.recipeId);
    if (!recipe) continue;

    const machine = recipe.machine;
    if (!machine.buildCosts || machine.buildCosts.length === 0) continue;

    const runCount = node.data.solution?.solved ? node.data.solution.runCount : 1;
    const buildingCount = Math.ceil(runCount);

    // Per-machine aggregation
    const existing = machineAgg.get(machine.id);
    if (existing) {
      existing.buildingCount += buildingCount;
      for (let i = 0; i < machine.buildCosts.length; i++) {
        existing.costs[i] = {
          product: existing.costs[i].product,
          quantity: existing.costs[i].quantity + machine.buildCosts[i].quantity * buildingCount,
        };
      }
    } else {
      machineAgg.set(machine.id, {
        machineId: machine.id,
        machineName: machine.name,
        buildingCount,
        costs: machine.buildCosts.map(c => ({
          product: c.product,
          quantity: c.quantity * buildingCount,
        })),
      });
    }

    // Product totals aggregation
    for (const cost of machine.buildCosts) {
      const existingTotal = totalsByProduct.get(cost.product.id);
      if (existingTotal) {
        existingTotal.quantity += cost.quantity * buildingCount;
      } else {
        totalsByProduct.set(cost.product.id, {
          product: cost.product,
          quantity: cost.quantity * buildingCount,
        });
      }
    }
  }

  return {
    totals: Array.from(totalsByProduct.values()).sort((a, b) => b.quantity - a.quantity),
    machines: Array.from(machineAgg.values()).sort((a, b) => b.buildingCount - a.buildingCount),
  };
}
