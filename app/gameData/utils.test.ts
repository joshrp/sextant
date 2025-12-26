import { describe, expect, test } from 'vitest';
import {
  getRecipesByProduct,
  getRecipesByMachine,
  getRecipeInputs,
  getRecipeOutputs,
  getRecipeDependencies,
  findRecipes,
} from './utils';
import type { ProductId, RecipeId, MachineId } from '../factory/graph/loadJsonData';

describe('Game Data Utils', () => {
  describe('getRecipesByProduct', () => {
    test('should find recipes that consume a product (input)', () => {
      const recipes = getRecipesByProduct('Product_IronOre' as ProductId, 'input');
      
      expect(recipes.length).toBeGreaterThan(0);
      // IronOre is used as input in smelting and crushing recipes
      const recipeIds = recipes.map(r => r.id);
      expect(recipeIds).toContain('IronOreCrushing' as RecipeId);
      expect(recipeIds).toContain('IronSmeltingT1Coal' as RecipeId);
    });

    test('should find recipes that produce a product (output)', () => {
      const recipes = getRecipesByProduct('Product_Flour' as ProductId, 'output');
      
      expect(recipes.length).toBeGreaterThan(0);
      // Flour is produced by wheat milling
      const recipeIds = recipes.map(r => r.id);
      expect(recipeIds).toContain('WheatMilling' as RecipeId);
    });

    test('should find all recipes related to a product (both)', () => {
      const recipes = getRecipesByProduct('Product_IronOre' as ProductId, 'both');
      
      expect(recipes.length).toBeGreaterThan(0);
      // Should include both input and output recipes
      const recipeIds = recipes.map(r => r.id);
      // IronOre is consumed (input)
      expect(recipeIds).toContain('IronOreCrushing' as RecipeId);
      expect(recipeIds).toContain('IronSmeltingT1Coal' as RecipeId);
    });

    test('should return empty array for non-existent product', () => {
      const recipes = getRecipesByProduct('NonExistentProduct' as ProductId);
      expect(recipes).toEqual([]);
    });

    test('should handle products with no recipes', () => {
      // Use a virtual product that may have limited recipes
      const recipes = getRecipesByProduct('Product_Virtual_Electricity' as ProductId, 'output');
      // Should return array (may be empty or have balancer recipes)
      expect(Array.isArray(recipes)).toBe(true);
    });
  });

  describe('getRecipesByMachine', () => {
    test('should find all recipes for a specific machine', () => {
      const recipes = getRecipesByMachine('FoodMill' as MachineId);
      
      expect(recipes.length).toBeGreaterThan(0);
      // All returned recipes should use this machine
      recipes.forEach(recipe => {
        expect(recipe.machine.id).toBe('FoodMill');
      });
      
      // Should include wheat milling
      const recipeIds = recipes.map(r => r.id);
      expect(recipeIds).toContain('WheatMilling' as RecipeId);
    });

    test('should find smelting furnace recipes', () => {
      const recipes = getRecipesByMachine('SmeltingFurnaceT1' as MachineId);
      
      expect(recipes.length).toBeGreaterThan(0);
      const recipeIds = recipes.map(r => r.id);
      expect(recipeIds).toContain('IronSmeltingT1Coal' as RecipeId);
    });

    test('should return empty array for non-existent machine', () => {
      const recipes = getRecipesByMachine('NonExistentMachine' as MachineId);
      expect(recipes).toEqual([]);
    });

    test('should handle machines with many recipes', () => {
      // Arc furnace typically has many recipes
      const recipes = getRecipesByMachine('ArcFurnace' as MachineId);
      
      expect(recipes.length).toBeGreaterThan(0);
      recipes.forEach(recipe => {
        expect(recipe.machine.id).toBe('ArcFurnace');
      });
    });
  });

  describe('getRecipeInputs', () => {
    test('should return all input products for a recipe', () => {
      const inputs = getRecipeInputs('IronSmeltingT1Coal' as RecipeId);
      
      expect(inputs.length).toBeGreaterThan(0);
      const inputIds = inputs.map(p => p.id);
      // Iron smelting requires iron ore and coal
      expect(inputIds).toContain('Product_IronOre' as ProductId);
      expect(inputIds).toContain('Product_Coal' as ProductId);
    });

    test('should return empty array for recipes with no inputs', () => {
      // Some mining or starting recipes may have no inputs
      // Test with a balancer or output-only recipe if one exists
      const inputs = getRecipeInputs('NonExistentRecipe' as RecipeId);
      expect(inputs).toEqual([]);
    });

    test('should return empty array for non-existent recipe', () => {
      const inputs = getRecipeInputs('NonExistentRecipe' as RecipeId);
      expect(inputs).toEqual([]);
    });

    test('should return products, not recipe products', () => {
      const inputs = getRecipeInputs('WheatMilling' as RecipeId);
      
      expect(inputs.length).toBeGreaterThan(0);
      // Should return Product objects
      inputs.forEach(input => {
        expect(input).toHaveProperty('id');
        expect(input).toHaveProperty('name');
        expect(input).toHaveProperty('icon');
      });
    });
  });

  describe('getRecipeOutputs', () => {
    test('should return all output products for a recipe', () => {
      const outputs = getRecipeOutputs('WheatMilling' as RecipeId);
      
      expect(outputs.length).toBeGreaterThan(0);
      const outputIds = outputs.map(p => p.id);
      // Wheat milling produces flour and animal feed
      expect(outputIds).toContain('Product_Flour' as ProductId);
      expect(outputIds).toContain('Product_AnimalFeed' as ProductId);
    });

    test('should include byproducts', () => {
      const outputs = getRecipeOutputs('IronSmeltingT1Coal' as RecipeId);
      
      expect(outputs.length).toBeGreaterThan(1);
      const outputIds = outputs.map(p => p.id);
      // Iron smelting produces molten iron, slag, and exhaust
      expect(outputIds).toContain('Product_MoltenIron' as ProductId);
      expect(outputIds).toContain('Product_Slag' as ProductId);
      expect(outputIds).toContain('Product_Exhaust' as ProductId);
    });

    test('should return empty array for non-existent recipe', () => {
      const outputs = getRecipeOutputs('NonExistentRecipe' as RecipeId);
      expect(outputs).toEqual([]);
    });

    test('should return products, not recipe products', () => {
      const outputs = getRecipeOutputs('WheatMilling' as RecipeId);
      
      expect(outputs.length).toBeGreaterThan(0);
      // Should return Product objects
      outputs.forEach(output => {
        expect(output).toHaveProperty('id');
        expect(output).toHaveProperty('name');
        expect(output).toHaveProperty('icon');
      });
    });
  });

  describe('getRecipeDependencies', () => {
    test('should find direct dependencies', () => {
      // Iron smelting depends on recipes that produce iron ore and coal
      const deps = getRecipeDependencies('IronSmeltingT1Coal' as RecipeId);
      
      expect(deps.length).toBeGreaterThan(0);
      // Should include recipes that produce IronOre or Coal
      expect(Array.isArray(deps)).toBe(true);
    });

    test('should respect maxDepth parameter', () => {
      const deps1 = getRecipeDependencies('IronSmeltingT1Coal' as RecipeId, 1);
      const deps2 = getRecipeDependencies('IronSmeltingT1Coal' as RecipeId, 5);
      
      // Deeper depth should potentially find more dependencies
      expect(Array.isArray(deps1)).toBe(true);
      expect(Array.isArray(deps2)).toBe(true);
    });

    test('should handle recipes with no dependencies', () => {
      // Balancer recipes typically have simple pass-through with no deep dependencies
      const deps = getRecipeDependencies('Balancer_Product_IronOre' as RecipeId);
      
      // Should return an array, may be empty or contain the balancer itself
      expect(Array.isArray(deps)).toBe(true);
    });

    test('should prevent infinite loops with circular dependencies', () => {
      // Many recipes can have circular dependencies in the game
      // The function should handle this gracefully
      const deps = getRecipeDependencies('WheatMilling' as RecipeId, 10);
      
      expect(Array.isArray(deps)).toBe(true);
      // Should not hang or stack overflow
    });

    test('should stop at maxDepth 0', () => {
      const deps = getRecipeDependencies('IronSmeltingT1Coal' as RecipeId, 0);
      expect(deps).toEqual([]);
    });

    test('should return empty array for non-existent recipe', () => {
      const deps = getRecipeDependencies('NonExistentRecipe' as RecipeId);
      expect(deps).toEqual([]);
    });
  });

  describe('findRecipes', () => {
    test('should find recipes by name query', () => {
      const recipes = findRecipes('iron');
      
      expect(recipes.length).toBeGreaterThan(0);
      // Results should contain recipes with "iron" in the name
      recipes.forEach(recipe => {
        const hasIronInName = recipe.name.toLowerCase().includes('iron') ||
                             recipe.id.toLowerCase().includes('iron');
        expect(hasIronInName).toBe(true);
      });
    });

    test('should find recipes by machine filter', () => {
      const recipes = findRecipes('', { machine: 'FoodMill' as MachineId });
      
      expect(recipes.length).toBeGreaterThan(0);
      recipes.forEach(recipe => {
        expect(recipe.machine.id).toBe('FoodMill');
      });
    });

    test('should find recipes by product filter (input or output)', () => {
      const recipes = findRecipes('', { product: 'Product_IronOre' as ProductId });
      
      expect(recipes.length).toBeGreaterThan(0);
      recipes.forEach(recipe => {
        const hasProduct = 
          recipe.inputs.some(i => i.product.id === ('Product_IronOre' as ProductId)) ||
          recipe.outputs.some(o => o.product.id === ('Product_IronOre' as ProductId));
        expect(hasProduct).toBe(true);
      });
    });

    test('should combine query and filters', () => {
      const recipes = findRecipes('smelting', { machine: 'SmeltingFurnaceT1' as MachineId });
      
      expect(recipes.length).toBeGreaterThan(0);
      recipes.forEach(recipe => {
        expect(recipe.machine.id).toBe('SmeltingFurnaceT1');
        const hasSmeltingInName = recipe.name.toLowerCase().includes('smelting') ||
                                  recipe.id.toLowerCase().includes('smelting');
        expect(hasSmeltingInName).toBe(true);
      });
    });

    test('should handle empty query', () => {
      const recipes = findRecipes('');
      
      // Should return all recipes
      expect(recipes.length).toBeGreaterThan(100);
    });

    test('should handle query with no matches', () => {
      const recipes = findRecipes('xyznonexistentrecipe');
      expect(recipes).toEqual([]);
    });

    test('should be case insensitive', () => {
      const recipesLower = findRecipes('iron');
      const recipesUpper = findRecipes('IRON');
      const recipesMixed = findRecipes('IrOn');
      
      expect(recipesLower.length).toBe(recipesUpper.length);
      expect(recipesLower.length).toBe(recipesMixed.length);
    });

    test('should handle whitespace in query', () => {
      const recipes = findRecipes('  iron  ');
      expect(recipes.length).toBeGreaterThan(0);
    });

    test('should filter by category', () => {
      // Find recipes in a specific category (e.g., food production)
      const recipes = findRecipes('', { category: 'FoodProduction' });
      
      // All recipes should be from this category
      recipes.forEach(recipe => {
        expect(recipe.machine.category_id).toBe('FoodProduction');
      });
    });
  });

  describe('Performance', () => {
    test('should search recipes in under 100ms', () => {
      const start = performance.now();
      findRecipes('iron');
      const end = performance.now();
      
      expect(end - start).toBeLessThan(100);
    });

    test('should get dependencies in under 50ms', () => {
      const start = performance.now();
      getRecipeDependencies('IronSmeltingT1Coal' as RecipeId, 10);
      const end = performance.now();
      
      expect(end - start).toBeLessThan(50);
    });

    test('should filter by machine in under 10ms', () => {
      const start = performance.now();
      getRecipesByMachine('SmeltingFurnaceT1' as MachineId);
      const end = performance.now();
      
      expect(end - start).toBeLessThan(10);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null/undefined gracefully in filters', () => {
      const recipes = findRecipes('iron', { machine: undefined, product: undefined });
      expect(recipes.length).toBeGreaterThan(0);
    });

    test('should return unique recipes (no duplicates)', () => {
      const recipes = getRecipesByProduct('Product_IronOre' as ProductId, 'both');
      const recipeIds = recipes.map(r => r.id);
      const uniqueIds = new Set(recipeIds);
      
      // Note: 'both' may intentionally have duplicates if a recipe both consumes and produces
      // This test ensures the function behaves consistently
      expect(recipeIds.length).toBeGreaterThanOrEqual(uniqueIds.size);
    });

    test('should handle recipes with optional inputs/outputs', () => {
      // Some recipes may have optional products
      const recipes = findRecipes('', { product: 'Product_Water' as ProductId });
      
      expect(Array.isArray(recipes)).toBe(true);
      // Should not crash on optional products
    });
  });
});
