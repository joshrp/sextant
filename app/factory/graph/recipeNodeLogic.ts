/**
 * Pure logic functions for RecipeNode component
 * Extracted for testability
 */
import type { Node } from '@xyflow/react';
import { formatNumber } from '~/uiUtils';
import { ProductId, type Recipe, type RecipeId } from './loadJsonData';
import { getProductCategory, isFoodCategory, type SettlementCategory } from './settlementCategories';
import { recyclablesProductId, totalRecyclablesOutput } from './recyclables';
import Big from "big.js"

export type HandleDropAlignment = {
  x: number;
  y: number;
  productId: ProductId;
  handleType: 'input' | 'output';
  sourceHandleX?: number;
  sourceHandleType?: 'input' | 'output';
};

export type NodeBaseData = {
  ltr?: boolean; // Left to right layout
  // Type of the node, rendering and calculations may differ based on type. Default is "recipe".
  type?: "recipe" | "settlement" | "balancer";
  alignToDrop?: HandleDropAlignment;
  solution?: {
    solved: true,
    // Mult for the recipe
    runCount: number,
  } | {
    solved: false
  },
}

// RecipeNodeData type - defined here to avoid circular dependency
export type RecipeNodeData = NodeBaseData & {
  type: "recipe";
  recipeId: RecipeId; // Unique identifier for the recipe
};

export type BalancerNodeData = NodeBaseData & {
  type: "balancer";
  recipeId: RecipeId; // Unique identifier for the balancer recipe
};

export type SettlementNodeData = NodeBaseData & {
  type: "settlement";
  recipeId: RecipeId; // Unique identifier for the settlement recipe
  options: {
    inputs: Partial<Record<ProductId, boolean>>;
    outputs: Partial<Record<ProductId, boolean>>;
  }
};

export type NodeDataTypes = RecipeNodeData | BalancerNodeData | SettlementNodeData;

/**
 * React Flow node type for recipe/balancer/settlement nodes.
 * Lives here (not in RecipeNode.tsx) so it can be imported by non-component code.
 */
export type RecipeNodeType = Node<NodeDataTypes>;

/**
 * Calculates the display value for a product quantity
 */
export function getQuantityDisplay(quantity: number, runCount: number, unit: string): string {
  const amount = quantity * runCount;
  return formatNumber(amount, unit);
}

export const isOptionEnabled = (
  map: Partial<Record<ProductId, boolean>> | undefined,
  id: ProductId,
): boolean => map?.[id] !== false;

// Pairs of (input, output) that are linked: disabling one zeros the other
const linkedProducts: Array<[ProductId, ProductId]> = [
  [ProductId("Product_Water"), ProductId("Product_WasteWater")],
];

export const SettlementCalculator = (recipe: Recipe, options: SettlementNodeData["options"], runCount: number) => {
  const foodCategoriesMet = new Set<SettlementCategory>();
  const categoryItemsMet = new Map<SettlementCategory, number>();
  const inputRatios = {} as Record<ProductId, Big>;
  const outputRatios = {} as Record<ProductId, Big>;

  recipe.inputs.forEach(input => {
    const category = getProductCategory(input.product.id);
    if (category && isFoodCategory(category)) {
      if (options.inputs?.[input.product.id] === true) {
        foodCategoriesMet.add(category);
        categoryItemsMet.set(category, (categoryItemsMet.get(category) || 0) + 1);
      }
    }
  });

  recipe.inputs.forEach(input => {
    let baseQty = Big(input.quantity);
    const category = getProductCategory(input.product.id);
    const isFoodInput = category !== null && isFoodCategory(category);

    if (isFoodInput && options.inputs?.[input.product.id] !== true) {
      inputRatios[input.product.id] = Big(0);
      return;
    }

    if (!isFoodInput && !isOptionEnabled(options.inputs, input.product.id)) {
      inputRatios[input.product.id] = Big(0);
      return;
    }

    if (category !== null && isFoodCategory(category)) {
      // Reduce the amount of food based on how many categories of food are delivered, 
      //  and how many items in the same category are delivered
      baseQty = baseQty.div(foodCategoriesMet.size * (categoryItemsMet.get(category) || 1));
    }

    inputRatios[input.product.id] = baseQty;
  });

  recipe.outputs.forEach(output => {
    let baseQty = Big(output.quantity);
    if (!isOptionEnabled(options.outputs, output.product.id)) {
      outputRatios[output.product.id] = Big(0);
      return;
    }

    switch (output.product.id) {
      case recyclablesProductId:
        baseQty = baseQty.plus(totalRecyclablesOutput(inputRatios));
        break;
    }

    outputRatios[output.product.id] = baseQty;
  });

  // Apply linked product rules: disabling one side zeros the other
  for (const [inputId, outputId] of linkedProducts) {
    if (!isOptionEnabled(options.outputs, outputId)) {
      inputRatios[inputId] = Big(0);
    }
    if (!isOptionEnabled(options.inputs, inputId)) {
      outputRatios[outputId] = Big(0);
    }
  }

  // Waste here, after everything else is known
  // If Biomass is not enabled add it to waste and turn it's output to 0
  // If recycling is not enabled, add recycled products to waste and turn their outputs to 0

  return {
    productInput: (productId: ProductId): number => {
      return (inputRatios[productId] ?? 0).mul(runCount).toNumber();
    },
    productOutput: (productId: ProductId): number => {
      return (outputRatios[productId] ?? 0).mul(runCount).toNumber();
    },
  }
}

export const BalancerCalculator = () => {
  return (): number => {
    return 0; // Placeholder implementation
  }
}

export const BasicCalculator = () => {
  return {
    productRatio: (): number => {
      return 0; // Placeholder implementation
    }
  };
}
