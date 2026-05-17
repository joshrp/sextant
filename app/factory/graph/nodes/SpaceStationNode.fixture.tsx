import { ReactFlowProvider } from '@xyflow/react';
import { useState } from 'react';
import { useFixtureInput } from 'react-cosmos/client';
import { loadData, type ProductId, type RecipeId } from '../loadJsonData';
import RecipeNodeView from './RecipeNodeView';
import { DEFAULT_ZONE_MODIFIERS } from '../../../context/zoneModifiers';
import type { RecipeNodeOptions, SpaceStationNodeOptions } from './recipeNodeLogic';

// Visual check for SpaceStation and Launch nodes.
// SpaceStation renders a +/- level stepper. The active level resolves through
// SpaceStationCalculator using the regime's base + (level - regime.minLevel) × delta.
// Launch nodes look like a plain recipe node — they scale continuously per-minute.

const { recipes } = loadData();

const createStationFixture = (defaultLevel: number, width = 700) => {
  const [flipped, setFlipped] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [level, setLevel] = useState(defaultLevel);
  const zoomLevel = useFixtureInput('Zoom Level', 0)[0] as 0 | 1 | 2 | 3;
  const scaleVal = useFixtureInput('Zoom Scale', 1)[0];

  const recipe = recipes.get('SpaceStation_Recipe' as RecipeId);
  if (!recipe) {
    return <div style={{ color: 'red', padding: 20 }}>SpaceStation_Recipe not found. Run `npm run formatData`.</div>;
  }

  const inputEdges = new Map<ProductId, boolean>();
  const outputEdges = new Map<ProductId, boolean>();
  for (const { product } of recipe.inputs) inputEdges.set(product.id, false);
  for (const { product } of recipe.outputs) outputEdges.set(product.id, false);

  return (
    <ReactFlowProvider>
      <div style={{ background: '#1a1a1a', padding: 20, resize: 'both', overflow: 'auto', width: `${width}px`, transform: `scale(${scaleVal})` }}>
        {removed && <h2>Removed</h2>}
        <RecipeNodeView
          recipe={recipe}
          inputEdges={inputEdges}
          outputEdges={outputEdges}
          solution={{ solved: true, runCount: 1 }}
          ltr={!flipped}
          zoomLevel={zoomLevel}
          onFlip={() => setFlipped(!flipped)}
          onRemove={() => setRemoved(true)}
          nodeOptions={{ level } as unknown as RecipeNodeOptions}
          setOptions={(opts) => {
            const o = opts as unknown as SpaceStationNodeOptions | undefined;
            if (o?.level !== undefined) setLevel(o.level);
          }}
          modifiers={DEFAULT_ZONE_MODIFIERS}
        />
      </div>
    </ReactFlowProvider>
  );
};

const createLaunchFixture = (recipeIdStart: string, runCount: number, width = 600) => {
  const [flipped, setFlipped] = useState(false);
  const zoomLevel = useFixtureInput('Zoom Level', 0)[0] as 0 | 1 | 2 | 3;

  const recipe = recipes.get(recipeIdStart as RecipeId);
  if (!recipe) {
    return <div style={{ color: 'red', padding: 20 }}>Recipe `{recipeIdStart}` not found. Run `npm run formatData`.</div>;
  }

  const inputEdges = new Map<ProductId, boolean>();
  const outputEdges = new Map<ProductId, boolean>();
  for (const { product } of recipe.inputs) inputEdges.set(product.id, false);
  for (const { product } of recipe.outputs) outputEdges.set(product.id, false);

  return (
    <ReactFlowProvider>
      <div style={{ background: '#1a1a1a', padding: 20, width: `${width}px` }}>
        <RecipeNodeView
          recipe={recipe}
          inputEdges={inputEdges}
          outputEdges={outputEdges}
          solution={{ solved: true, runCount }}
          ltr={!flipped}
          zoomLevel={zoomLevel}
          onFlip={() => setFlipped(!flipped)}
          onRemove={() => {}}
          modifiers={DEFAULT_ZONE_MODIFIERS}
        />
      </div>
    </ReactFlowProvider>
  );
};

export default {
  'SpaceStation — Level 1 (basic regime)': () => createStationFixture(1),
  'SpaceStation — Level 2 (basic + 1×delta)': () => createStationFixture(2),
  'SpaceStation — Level 3 (advanced base, RP=48)': () => createStationFixture(3),
  'SpaceStation — Level 5 (advanced + 2×delta, RP=80)': () => createStationFixture(5),
  'SpaceStation — Level 8 (advanced + 5×delta)': () => createStationFixture(8),
  'Launch — 1 rocket/min': () => createLaunchFixture('Launch_SpaceStationParts1_T1', 1),
  'Launch — 0.75 rockets/min (continuous)': () => createLaunchFixture('Launch_SpaceStationParts1_T1', 0.75),
  'Launch — 6.25 rockets/min (high demand)': () => createLaunchFixture('Launch_SpaceStationParts1_T1', 6.25),
};
