import { ReactFlowProvider } from '@xyflow/react';
import { useState } from 'react';
import { useFixtureInput } from 'react-cosmos/client';
import { loadData, type ProductId, type RecipeId } from '../loadJsonData';
import type { ThermalStorageNodeViewProps } from './ThermalStorageNodeView';
import ThermalStorageNodeView from './ThermalStorageNodeView';
import type { ThermalStorageNodeOptions } from './recipeNodeLogic';
import { DEFAULT_ZONE_MODIFIERS } from '../../../context/zoneModifiers';

const { recipes } = loadData();

const createFixture = (
  recipeId: RecipeId,
  defaultLoss: number,
  propsOverrides?: Partial<ThermalStorageNodeViewProps>,
) => {
  const recipe = recipes.get(recipeId);
  const [flipped, setFlipped] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [options, setOptions] = useState<ThermalStorageNodeOptions>({ loss: defaultLoss });
  const zoomLevel = useFixtureInput('Zoom Level', 0)[0] as 0 | 1 | 2 | 3;
  const [runCount] = useFixtureInput('Run Count', 1);
  const scaleVal = useFixtureInput('Zoom Scale', 1)[0];

  if (!recipe) {
    return <div>Thermal storage recipe not found: {recipeId}</div>;
  }

  const inputEdges = new Map<ProductId, boolean>();
  const outputEdges = new Map<ProductId, boolean>();
  for (const { product } of recipe.inputs) {
    inputEdges.set(product.id, false);
  }
  for (const { product } of recipe.outputs) {
    outputEdges.set(product.id, false);
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
        <ThermalStorageNodeView
          recipe={recipe}
          thermalStorageOptions={options}
          setOptions={setOptions}
          inputEdges={inputEdges}
          outputEdges={outputEdges}
          solution={{ solved: propsOverrides?.solution?.solved ?? true, runCount }}
          ltr={!flipped}
          zoomLevel={zoomLevel}
          onFlip={() => setFlipped(!flipped)}
          onRemove={() => setRemoved(true)}
          modifiers={DEFAULT_ZONE_MODIFIERS}
          {...propsOverrides}
        />
      </div>
    </ReactFlowProvider>
  );
};

export default {
  'Default (10% loss, LP steam)': () =>
    createFixture('ThermalStorage_Product_SteamLP' as RecipeId, 10),

  'High loss (50%, HP steam)': () =>
    createFixture('ThermalStorage_Product_SteamHi' as RecipeId, 50),

  'Zero loss (0%, SP steam)': () =>
    createFixture('ThermalStorage_Product_SteamSp' as RecipeId, 0),
};
