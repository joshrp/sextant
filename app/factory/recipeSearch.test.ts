import { describe, it, expect } from 'vitest';
import { prepareRecipesForSearch, searchRecipes, groupRecipesByTier } from './recipeSearch';
import type { Recipe, Product, ProductId, MachineId, CategoryId } from './graph/loadJsonData';
import { RecipeId } from './graph/loadJsonData';

// Helper to create minimal recipe objects for testing
function createMockRecipe(overrides: Omit<Partial<Recipe>, 'id'> & { id: string }): Recipe {
  const { id, ...rest } = overrides;
  return {
    id: RecipeId(id),
    duration: 60,
    inputs: [],
    outputs: [],
    machine: {
      id: 'TestMachine' as MachineId,
      name: 'Test Machine',
      category_id: 'TestCategory' as CategoryId,
      workers: 1,
      workers_generated: 0,
      electricity_consumed: 0,
      electricity_generated: 0,
      computing_consumed: 0,
      computing_generated: 0,
      storage_capacity: 0,
      unity_cost: 0,
      research_speed: 0,
      isFarm: false,
      isBalancer: false,
      recipes: [],
      icon: 'test.png',
      buildCosts: [],
    },
    ...rest,
  } as Recipe;
}

function createMockProduct(id: string, name: string): Product {
  return {
    id: id as ProductId,
    name,
    icon: `${id}.png`,
    color: '#ffffff',
    unit: '',
    transport: 'Flat' as const,
    recipes: { input: [], output: [] },
    machines: { input: [], output: [] },
  };
}

describe('recipeSearch', () => {
  describe('prepareRecipesForSearch', () => {
    it('extracts product names from inputs and outputs', () => {
      const ironProduct = createMockProduct('iron', 'Iron Ore');
      const steelProduct = createMockProduct('steel', 'Steel');
      
      const recipe = createMockRecipe({
        id: 'smelt-steel',
        inputs: [{ product: ironProduct, quantity: 2 }],
        outputs: [{ product: steelProduct, quantity: 1 }],
      });

      const result = prepareRecipesForSearch([recipe]);

      expect(result).toHaveLength(1);
      expect(result[0].recipe).toBe(recipe);
      expect(result[0].searchTerms).toEqual(['Iron Ore', 'Steel']);
    });

    it('handles recipes with multiple inputs and outputs', () => {
      const coal = createMockProduct('coal', 'Coal');
      const iron = createMockProduct('iron', 'Iron Ore');
      const steel = createMockProduct('steel', 'Steel');
      const slag = createMockProduct('slag', 'Slag');

      const recipe = createMockRecipe({
        id: 'smelt-steel',
        inputs: [
          { product: iron, quantity: 2 },
          { product: coal, quantity: 1 },
        ],
        outputs: [
          { product: steel, quantity: 1 },
          { product: slag, quantity: 1, optional: true },
        ],
      });

      const result = prepareRecipesForSearch([recipe]);

      expect(result[0].searchTerms).toEqual(['Iron Ore', 'Coal', 'Steel', 'Slag']);
    });

    it('handles empty recipes list', () => {
      const result = prepareRecipesForSearch([]);
      expect(result).toEqual([]);
    });
  });

  describe('searchRecipes', () => {
    const steel = createMockProduct('steel', 'Steel');
    const iron = createMockProduct('iron', 'Iron Ore');
    const copper = createMockProduct('copper', 'Copper Ore');
    const gold = createMockProduct('gold', 'Gold');

    const steelRecipe = createMockRecipe({
      id: 'smelt-steel',
      inputs: [{ product: iron, quantity: 2 }],
      outputs: [{ product: steel, quantity: 1 }],
    });

    const copperRecipe = createMockRecipe({
      id: 'smelt-copper',
      inputs: [{ product: copper, quantity: 2 }],
      outputs: [{ product: gold, quantity: 1 }],
    });

    const balancerRecipe = createMockRecipe({
      id: 'balancer',
      machine: {
        ...steelRecipe.machine,
        isBalancer: true,
      },
    });

    it('returns all non-balancer recipes when search is empty', () => {
      const prepared = prepareRecipesForSearch([steelRecipe, copperRecipe, balancerRecipe]);
      const result = searchRecipes(prepared, '');

      expect(result.matchedRecipes).toHaveLength(2);
      expect(result.unmatchedRecipes).toHaveLength(0);
      expect(result.balancerRecipe).toBe(balancerRecipe);
    });

    it('returns all non-balancer recipes when search is whitespace', () => {
      const prepared = prepareRecipesForSearch([steelRecipe, copperRecipe]);
      const result = searchRecipes(prepared, '   ');

      expect(result.matchedRecipes).toHaveLength(2);
      expect(result.unmatchedRecipes).toHaveLength(0);
    });

    it('filters recipes by matching input product name', () => {
      const prepared = prepareRecipesForSearch([steelRecipe, copperRecipe]);
      const result = searchRecipes(prepared, 'Iron');

      expect(result.matchedRecipes).toHaveLength(1);
      expect(result.matchedRecipes[0].recipe.id).toBe('smelt-steel');
      expect(result.unmatchedRecipes).toHaveLength(1);
      expect(result.unmatchedRecipes[0].id).toBe('smelt-copper');
    });

    it('filters recipes by matching output product name', () => {
      const prepared = prepareRecipesForSearch([steelRecipe, copperRecipe]);
      const result = searchRecipes(prepared, 'Gold');

      expect(result.matchedRecipes).toHaveLength(1);
      expect(result.matchedRecipes[0].recipe.id).toBe('smelt-copper');
      expect(result.unmatchedRecipes).toHaveLength(1);
    });

    it('performs fuzzy matching', () => {
      const prepared = prepareRecipesForSearch([steelRecipe, copperRecipe]);
      const result = searchRecipes(prepared, 'Stel'); // typo for Steel

      expect(result.matchedRecipes).toHaveLength(1);
      expect(result.matchedRecipes[0].recipe.id).toBe('smelt-steel');
    });

    it('ranks recipes with more matches higher', () => {
      const multiMatchRecipe = createMockRecipe({
        id: 'multi-ore',
        inputs: [
          { product: iron, quantity: 1 },
          { product: copper, quantity: 1 },
        ],
        outputs: [{ product: steel, quantity: 1 }],
      });

      const singleMatchRecipe = createMockRecipe({
        id: 'single-ore',
        inputs: [{ product: iron, quantity: 1 }],
        outputs: [{ product: gold, quantity: 1 }],
      });

      const prepared = prepareRecipesForSearch([singleMatchRecipe, multiMatchRecipe]);
      const result = searchRecipes(prepared, 'Ore');

      // Both should match since both have "Ore" in product names
      expect(result.matchedRecipes).toHaveLength(2);
      // Multi-match recipe should be first (has Iron Ore AND Copper Ore)
      expect(result.matchedRecipes[0].recipe.id).toBe('multi-ore');
      expect(result.matchedRecipes[1].recipe.id).toBe('single-ore');
    });

    it('extracts balancer recipe separately', () => {
      const prepared = prepareRecipesForSearch([steelRecipe, balancerRecipe]);
      const result = searchRecipes(prepared, '');

      expect(result.matchedRecipes).toHaveLength(1);
      expect(result.matchedRecipes[0].recipe.id).toBe('smelt-steel');
      expect(result.balancerRecipe).toBe(balancerRecipe);
    });

    it('returns null balancerRecipe when none exists', () => {
      const prepared = prepareRecipesForSearch([steelRecipe, copperRecipe]);
      const result = searchRecipes(prepared, '');

      expect(result.balancerRecipe).toBeNull();
    });
  });

  describe('groupRecipesByTier', () => {
    it('groups recipes by tiersLink', () => {
      const recipe1 = createMockRecipe({ id: 'recipe-t1', tiersLink: 'recipe-tier' });
      const recipe2 = createMockRecipe({ id: 'recipe-t2', tiersLink: 'recipe-tier' });
      const recipe3 = createMockRecipe({ id: 'other-recipe' });

      const result = groupRecipesByTier([
        { recipe: recipe1, matchedTerms: new Set<string>() },
        { recipe: recipe2, matchedTerms: new Set<string>() },
        { recipe: recipe3, matchedTerms: new Set<string>() },
      ]);

      expect(result.size).toBe(2);
      expect(result.get('recipe-tier')?.map(item => item.recipe)).toEqual([recipe1, recipe2]);
      expect(result.get('other-recipe')?.map(item => item.recipe)).toEqual([recipe3]);
    });

    it('uses recipe id when no tiersLink', () => {
      const recipe1 = createMockRecipe({ id: 'recipe-1' });
      const recipe2 = createMockRecipe({ id: 'recipe-2' });

      const result = groupRecipesByTier([
        { recipe: recipe1, matchedTerms: new Set<string>() },
        { recipe: recipe2, matchedTerms: new Set<string>() },
      ]);

      expect(result.size).toBe(2);
      expect(result.get('recipe-1')?.map(item => item.recipe)).toEqual([recipe1]);
      expect(result.get('recipe-2')?.map(item => item.recipe)).toEqual([recipe2]);
    });

    it('handles empty list', () => {
      const result = groupRecipesByTier([]);
      expect(result.size).toBe(0);
    });
  });
});
