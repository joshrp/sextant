import { loadData, type ProductId, type RecipeId, type MachineId, type Recipe, type Product } from "../factory/graph/loadJsonData";

/**
 * Get all recipes that produce or consume a specific product
 * @param productId - The product to search for
 * @param direction - 'output' for recipes that produce, 'input' for recipes that consume, 'both' for either
 */
export function getRecipesByProduct(
  productId: ProductId,
  direction: 'input' | 'output' | 'both' = 'both'
): Recipe[] {
  const { products } = loadData();
  const product = products.get(productId);
  
  if (!product) {
    return [];
  }
  
  switch (direction) {
    case 'input':
      return product.recipes.input;
    case 'output':
      return product.recipes.output;
    case 'both':
      return [...product.recipes.input, ...product.recipes.output];
  }
}

/**
 * Get all recipes that can be crafted in a specific machine
 */
export function getRecipesByMachine(machineId: MachineId): Recipe[] {
  const { machines } = loadData();
  const machine = machines.get(machineId);
  
  if (!machine) {
    return [];
  }
  
  return machine.recipes;
}

/**
 * Get all input products for a recipe
 */
export function getRecipeInputs(recipeId: RecipeId): Product[] {
  const { recipes } = loadData();
  const recipe = recipes.get(recipeId);
  
  if (!recipe) {
    return [];
  }
  
  return recipe.inputs.map(rp => rp.product);
}

/**
 * Get all output products for a recipe (including byproducts)
 */
export function getRecipeOutputs(recipeId: RecipeId): Product[] {
  const { recipes } = loadData();
  const recipe = recipes.get(recipeId);
  
  if (!recipe) {
    return [];
  }
  
  return recipe.outputs.map(rp => rp.product);
}

/**
 * Get all recipes that produce inputs needed by the given recipe
 * @param recipeId - The recipe to find dependencies for
 * @param maxDepth - Maximum depth to traverse (prevents infinite loops)
 * @param visited - Set of visited recipes (internal, used for recursion)
 */
export function getRecipeDependencies(
  recipeId: RecipeId,
  maxDepth = 10,
  visited: Set<RecipeId> = new Set()
): RecipeId[] {
  if (maxDepth <= 0 || visited.has(recipeId)) {
    return [];
  }
  
  const { recipes } = loadData();
  const recipe = recipes.get(recipeId);
  
  if (!recipe) {
    return [];
  }
  
  visited.add(recipeId);
  const dependencies: RecipeId[] = [];
  
  // For each input product, find recipes that produce it
  for (const input of recipe.inputs) {
    const producingRecipes = input.product.recipes.output;
    
    for (const producingRecipe of producingRecipes) {
      if (!visited.has(producingRecipe.id)) {
        dependencies.push(producingRecipe.id);
        
        // Recursively get dependencies of the producing recipe
        const subDeps = getRecipeDependencies(
          producingRecipe.id,
          maxDepth - 1,
          visited
        );
        dependencies.push(...subDeps);
      }
    }
  }
  
  return dependencies;
}

/**
 * Search and filter recipes based on query and filters
 */
export function findRecipes(
  query: string,
  filters?: {
    machine?: MachineId;
    product?: ProductId;
    category?: string;
  }
): Recipe[] {
  const { recipes } = loadData();
  let results: Recipe[] = Array.from(recipes.values());
  
  // Apply machine filter
  if (filters?.machine) {
    results = results.filter(r => r.machine.id === filters.machine);
  }
  
  // Apply product filter (recipe must produce or consume this product)
  if (filters?.product) {
    results = results.filter(r => {
      const hasInput = r.inputs.some(i => i.product.id === filters.product);
      const hasOutput = r.outputs.some(o => o.product.id === filters.product);
      return hasInput || hasOutput;
    });
  }
  
  // Apply category filter
  if (filters?.category) {
    results = results.filter(r => r.machine.category_id === filters.category);
  }
  
  // Apply text search on recipe name
  const trimmedQuery = query.trim();
  if (trimmedQuery !== '') {
    const lowerQuery = trimmedQuery.toLowerCase();
    results = results.filter(r => 
      r.name.toLowerCase().includes(lowerQuery) ||
      r.id.toLowerCase().includes(lowerQuery)
    );
  }
  
  return results;
}
