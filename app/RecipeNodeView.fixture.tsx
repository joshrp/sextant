import { ReactFlowProvider } from '@xyflow/react';
import { useState } from 'react';
import { useFixtureInput, useFixtureSelect } from 'react-cosmos/client';
import { loadData, type ProductId, type RecipeId } from './factory/graph/loadJsonData';
import type { RecipeNodeViewProps } from './factory/graph/RecipeNodeView';
import RecipeNodeView from './factory/graph/RecipeNodeView';
import type { HighlightNone, HighlightProduct } from './factory/store';
import { DEFAULT_ZONE_MODIFIERS } from './context/zoneModifiers';

const { recipes } = loadData();

const createFixture = (recipeIdStart: string, width: number, propsOverrides?: Partial<RecipeNodeViewProps>) => {
  const [flipped, setFlipped] = useState(false);
  const [removed, setRemoved] = useState(false);
  const zoomLevel = useFixtureInput('Zoom Level', 0)[0] as 0 | 1 | 2 | 3;
  const [runCount] = useFixtureInput('Run Count', 1);
  const recipeId = useFixtureSelect('Recipe ID', {
    options:  recipes.keys().toArray(),
    defaultValue: recipeIdStart
  })[0];

  const recipe = recipes.get(recipeId as RecipeId);
  if (!recipe) throw new Error(`Recipe ${recipeId} not found`);
  
  const highlightMode = useFixtureInput('Highlight', false)[0];
  let highlight: HighlightProduct | HighlightNone = {
    mode: "none"
  };
  const scaleVal = useFixtureInput('Zoom Scale', 1)[0];

  const highlightProduct: HighlightProduct = {
    mode: "product",
    productId: useFixtureSelect('Highlight Product ID', {
      options: [...recipe.inputs.map(i => i.product.id), ...recipe.outputs.map(o => o.product.id)],
    })[0],
    options: {
      connected: useFixtureInput('Highlight Connected', true)[0],
      unconnected: useFixtureInput('Highlight Unconnected', true)[0],
      inputs: useFixtureInput('Highlight Inputs', true)[0],
      outputs: useFixtureInput('Highlight Outputs', true)[0],
      edges: useFixtureInput('Highlight Edges', true)[0],
    }
  }

  if (highlightMode) {
    highlight = highlightProduct;
  }
  const connectedInputs = new Array(10).fill(false).map((_, i) => useFixtureInput(`Input ${i + 1} Connected`, false)[0]);
  const connectedOutputs = new Array(10).fill(false).map((_, i) => useFixtureInput(`Output ${i + 1} Connected`, false)[0]);

  const connectedProducts = new Map<ProductId, boolean>();
  for (const [i, {product}] of recipe.inputs.entries()) {
    connectedProducts.set(product.id, connectedInputs[i]);
  }
  for (const [i, {product}] of recipe.outputs.entries()) {
    connectedProducts.set(product.id, connectedOutputs[i]);
  }

  return <ReactFlowProvider>
    <div style={{ background: '#1a1a1a', padding: '20px', resize: 'both', overflow: 'auto' 
      , width: `${width}px`,
      transform: `scale(${scaleVal})`,

    }}> 
      {removed && <h2>Removed</h2>}      
      <RecipeNodeView {...{
          recipe,
          productEdges: connectedProducts,
          solution: { solved: propsOverrides?.solution?.solved ?? true, runCount },
          
          ltr: !flipped,
          zoomLevel,
          onFlip: () => setFlipped(!flipped),
          onRemove: () => setRemoved(true),
          highlight,
          modifiers: DEFAULT_ZONE_MODIFIERS,
          ...propsOverrides
        }} />
    </div>
  </ReactFlowProvider>
};


export default {
  'Basic - Power Generator': () => createFixture('PowerGeneratorT2', 500),
  
  'Basic - Fast Breeder Reactor': () => createFixture('FastBreederReactorEnrichment2', 500),

  'State - Unsolved Solution': () => createFixture('TurbineHighPressT2',  500, {
    solution: { solved: false }
  }),

  'Complex - Turbine High Press': () => createFixture('TurbineHighPressT2', 500, {
    solution: { solved: true, runCount: 3.5 }
  }),

  'Balancer - Water': () => createFixture('Balancer_Product_Water', 400),
};
