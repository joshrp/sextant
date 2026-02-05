import fuzzysort from 'fuzzysort';
import type { Recipe, RecipeId } from "./graph/loadJsonData";

export type RecipeWithSearchTerms = {
  recipe: Recipe;
  searchTerms: string[];
};

export type RecipeMatch = {
  recipe: Recipe;
  matchedTerms: Set<string>;
};

export type SearchResult = {
  matchedRecipes: RecipeMatch[];
  unmatchedRecipes: Recipe[];
  balancerRecipe: Recipe | null;
};

/**
 * Prepares recipes with searchable product names from inputs and outputs
 */
export function prepareRecipesForSearch(recipes: Recipe[]): RecipeWithSearchTerms[] {
  return recipes.map(recipe => ({
    recipe,
    searchTerms: [
      ...recipe.inputs.map(i => i.product.name),
      ...recipe.outputs.map(o => o.product.name)
    ]
  }));
}

/**
 * Filters and sorts recipes based on fuzzy search term.
 * Matching recipes are sorted by score (more/better matches = higher).
 * Non-matching recipes are returned separately.
 * Balancer recipes are extracted and returned separately.
 */
export function searchRecipes(
  recipesWithTerms: RecipeWithSearchTerms[],
  searchTerm: string
): SearchResult {
  let balancer: Recipe | null = null;
  const nonBalancerRecipes = recipesWithTerms.filter(r => {
    if (r.recipe.machine.isBalancer) {
      balancer = r.recipe;
      return false;
    }
    return true;
  });

  if (!searchTerm.trim()) {
    return {
      matchedRecipes: nonBalancerRecipes.map(r => ({ recipe: r.recipe, matchedTerms: new Set<string>() })),
      unmatchedRecipes: [],
      balancerRecipe: balancer
    };
  }

  const matched: { recipe: Recipe; score: number; matchedTerms: Set<string> }[] = [];
  const unmatched: Recipe[] = [];

  for (const { recipe, searchTerms } of nonBalancerRecipes) {
    const results = fuzzysort.go(searchTerm, searchTerms);
    if (results.length > 0) {
      // Score based on number of matches and quality of matches
      const totalScore = results.reduce((sum, r) => sum + (r.score + 1000), 0);
      const matchedTerms = new Set(results.map(r => r.target));
      matched.push({ recipe, score: totalScore, matchedTerms });
    } else {
      unmatched.push(recipe);
    }
  }

  // Sort by score descending (higher is better)
  matched.sort((a, b) => b.score - a.score);

  return {
    matchedRecipes: matched.map(m => ({ recipe: m.recipe, matchedTerms: m.matchedTerms })),
    unmatchedRecipes: unmatched,
    balancerRecipe: balancer
  };
}

/**
 * Groups recipes by their tiersLink (or id if no tiersLink)
 */
export function groupRecipesByTier(recipes: RecipeMatch[]): Map<string, RecipeMatch[]> {
  const byLinkId = new Map<string, RecipeMatch[]>();
  recipes.forEach(match => {
    const linkId = match.recipe.tiersLink || match.recipe.id;
    if (byLinkId.has(linkId))
      byLinkId.get(linkId)!.push(match);
    else
      byLinkId.set(linkId, [match]);
  });
  return byLinkId;
}

/**
 * Creates a map of recipe IDs to their matched terms for quick lookup
 */
export function createMatchedTermsMap(matches: RecipeMatch[]): Map<RecipeId, Set<string>> {
  const map = new Map<RecipeId, Set<string>>();
  for (const match of matches) {
    map.set(match.recipe.id, match.matchedTerms);
  }
  return map;
}
