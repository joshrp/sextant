import { ReactFlowProvider } from '@xyflow/react';
import { useState } from 'react';
import { useFixtureInput } from 'react-cosmos/client';
import { loadData, type ProductId, type RecipeId } from './factory/graph/loadJsonData';
import type { SettlementNodeViewProps } from './factory/graph/SettlmentNodeView';
import SettlementNodeView from './factory/graph/SettlmentNodeView';
import type { SettlementNodeData } from './factory/graph/recipeNodeLogic';

const { recipes } = loadData();

// Get the Housing_Workers settlement recipe
const settlementRecipe = recipes.get('Housing_Workers' as RecipeId);

// Create default settlement options with all toggles enabled
const createDefaultOptions = (): SettlementNodeData["options"] => {
  const options: SettlementNodeData["options"] = {
    inputs: {} as Record<ProductId, boolean>,
    outputs: {} as Record<ProductId, boolean>,
  };
  
  if (settlementRecipe) {
    for (const input of settlementRecipe.inputs) {
      options.inputs[input.product.id] = true;
    }
    for (const output of settlementRecipe.outputs) {
      options.outputs[output.product.id] = true;
    }
  }
  
  return options;
};

const createFixture = (propsOverrides?: Partial<SettlementNodeViewProps>) => {
  const [flipped, setFlipped] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [options, setOptions] = useState<SettlementNodeData["options"]>(createDefaultOptions());
  const zoomLevel = useFixtureInput('Zoom Level', 0)[0] as 0 | 1 | 2 | 3;
  const [runCount] = useFixtureInput('Run Count', 1);
  const scaleVal = useFixtureInput('Zoom Scale', 1)[0];

  if (!settlementRecipe) {
    return <div>Settlement recipe not found</div>;
  }

  const connectedProducts = new Map<ProductId, boolean>();
  for (const { product } of settlementRecipe.inputs) {
    connectedProducts.set(product.id, false);
  }
  for (const { product } of settlementRecipe.outputs) {
    connectedProducts.set(product.id, false);
  }

  return (
    <ReactFlowProvider>
      <div
        style={{
          background: '#1a1a1a',
          padding: '20px',
          resize: 'both',
          overflow: 'auto',
          width: '600px',
          transform: `scale(${scaleVal})`,
        }}
      >
        {removed && <h2>Removed</h2>}
        <SettlementNodeView
          recipe={settlementRecipe}
          settlementOptions={options}
          setOptions={setOptions}
          productEdges={connectedProducts}
          solution={{ solved: propsOverrides?.solution?.solved ?? true, runCount }}
          ltr={!flipped}
          zoomLevel={zoomLevel}
          onFlip={() => setFlipped(!flipped)}
          onRemove={() => setRemoved(true)}
          {...propsOverrides}
        />
      </div>
    </ReactFlowProvider>
  );
};

export default {
  'Settlement - Housing Workers (Default)': () => createFixture(),

  'Settlement - With Solution': () =>
    createFixture({
      solution: { solved: true, runCount: 2.5 },
    }),

  'Settlement - Unsolved': () =>
    createFixture({
      solution: { solved: false },
    }),
};
