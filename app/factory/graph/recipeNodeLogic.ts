/**
 * Pure logic functions for RecipeNode component
 * Extracted for testability
 */
import { formatNumber } from '~/uiUtils';
import { ProductId, type Recipe, type RecipeId } from './loadJsonData';

export type NodeBaseData = {
  ltr?: boolean; // Left to right layout
  // Type of the node, rendering and calculations may differ based on type. Default is "recipe".
  type?: "recipe" | "settlement" | "balancer";
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
    inputs: Record<ProductId, boolean>;
    outputs: Record<ProductId, boolean>;
  }
};

export type NodeDataTypes = RecipeNodeData | BalancerNodeData | SettlementNodeData;

/**
 * Calculates the display value for a product quantity
 */
export function getQuantityDisplay(quantity: number, runCount: number, unit: string): string {
  const amount = quantity * runCount;
  return formatNumber(amount, unit);
}

export const SettlementCalculator = (recipeId: Recipe, options: SettlementNodeData["options"], runCount: number) => {
  return {
    productInput: (productId: ProductId): number => {
      const product = recipeId.inputs.find(input => input.product.id === productId);
      if (!product) return 0;

      let baseQty = product.quantity;
      switch (product.product.id) {
        case ProductId("Product_Water"):
          if (options?.outputs?.[ProductId("Product_WasteWater")] === false) {
            baseQty = 0;
          }
          break;
      }
      if (options.inputs?.[productId] === false) {
        baseQty = 0;
      }
      return baseQty * runCount;
    },
    productOutput: (productId: ProductId): number => {
      const product = recipeId.outputs.find(output => output.product.id === productId);
      if (!product) return 0;

      let baseQty = product.quantity;

      switch (product.product.id) {
        case ProductId("Product_WasteWater"):
          if (options?.inputs?.[ProductId("Product_Water")] === false) {
            baseQty = 0;
          }
          break;
      }
      return baseQty * runCount;
    },
  }
}

export const BalancerCalculator = (data: BalancerNodeData) => {
  return (productId: ProductId): number => {
    return 0; // Placeholder implementation
  }
}

export const BasicCalculator = (data: RecipeNodeData) => {
  return {
    productRatio: (productId: ProductId): number => {
      return 0; // Placeholder implementation
    }
  };
}
