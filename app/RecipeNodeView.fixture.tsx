import RecipeNodeView from './factory/graph/RecipeNodeView';
import type { RecipeNodeViewProps } from './factory/graph/RecipeNodeView';
import { loadData, type RecipeId } from './factory/graph/loadJsonData';

const { recipes } = loadData();

// Helper to create mock product edges
const createMockProductEdges = (recipe: ReturnType<typeof recipes.get>) => {
  const edges = new Map();
  if (recipe) {
    recipe.inputs.forEach(input => edges.set(input.product.id, null));
    recipe.outputs.forEach(output => edges.set(output.product.id, null));
  }
  return edges;
};

// Helper to get a recipe and create base props
const getRecipeProps = (recipeId: RecipeId, overrides?: Partial<RecipeNodeViewProps>): RecipeNodeViewProps => {
  const recipe = recipes.get(recipeId);
  if (!recipe) throw new Error(`Recipe ${recipeId} not found`);
  
  return {
    recipe,
    runCount: 1,
    productEdges: createMockProductEdges(recipe),
    ltr: true,
    isFarZoom: false,
    onFlip: () => console.log('Flip clicked'),
    onRemove: () => console.log('Remove clicked'),
    ...overrides,
  };
};

export default {
  'Basic - Power Generator': () => (
    <div style={{ background: '#1a1a1a', padding: '20px', resize: 'both', overflow: 'auto' }}>
      <RecipeNodeView {...getRecipeProps('PowerGeneratorT2' as RecipeId)} />
    </div>
  ),
  
  'Basic - Fast Breeder Reactor': () => (
    <div style={{ background: '#1a1a1a', padding: '20px', resize: 'both', overflow: 'auto' }}>
      <RecipeNodeView {...getRecipeProps('FastBreederReactorEnrichment2' as RecipeId)} />
    </div>
  ),

  'Layout - Right to Left': () => (
    <div style={{ background: '#1a1a1a', padding: '20px', resize: 'both', overflow: 'auto' }}>
      <RecipeNodeView {...getRecipeProps('PowerGeneratorT2' as RecipeId, { ltr: false })} />
    </div>
  ),

  'Zoom - Far Zoom (No Machine Icon)': () => (
    <div style={{ background: '#1a1a1a', padding: '20px', resize: 'both', overflow: 'auto' }}>
      <RecipeNodeView {...getRecipeProps('PowerGeneratorT2' as RecipeId, { isFarZoom: true })} />
    </div>
  ),

  'State - With Solution (Low Count)': () => (
    <div style={{ background: '#1a1a1a', padding: '20px', resize: 'both', overflow: 'auto' }}>
      <RecipeNodeView {...getRecipeProps('PowerGeneratorT2' as RecipeId, {
        runCount: 2.5,
        solution: { solved: true, runCount: 2.5 }
      })} />
    </div>
  ),

  'State - With Solution (High Count)': () => (
    <div style={{ background: '#1a1a1a', padding: '20px', resize: 'both', overflow: 'auto' }}>
      <RecipeNodeView {...getRecipeProps('PowerGeneratorT2' as RecipeId, {
        runCount: 15.75,
        solution: { solved: true, runCount: 15.75 }
      })} />
    </div>
  ),

  'State - Unsolved Solution': () => (
    <div style={{ background: '#1a1a1a', padding: '20px', resize: 'both', overflow: 'auto' }}>
      <RecipeNodeView {...getRecipeProps('TurbineHighPressT2' as RecipeId, {
        solution: { solved: false }
      })} />
    </div>
  ),

  'Complex - Turbine High Press': () => (
    <div style={{ background: '#1a1a1a', padding: '20px', resize: 'both', overflow: 'auto' }}>
      <RecipeNodeView {...getRecipeProps('TurbineHighPressT2' as RecipeId, {
        runCount: 3.5,
        solution: { solved: true, runCount: 3.5 }
      })} />
    </div>
  ),

  'Complex - Steam Depleted Condensation': () => (
    <div style={{ background: '#1a1a1a', padding: '20px', resize: 'both', overflow: 'auto' }}>
      <RecipeNodeView {...getRecipeProps('SteamDepletedCondensation' as RecipeId)} />
    </div>
  ),
};
