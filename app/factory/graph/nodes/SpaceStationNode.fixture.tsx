// Cosmos fixture file: default export is a fixture map (not a component),
// so `react-refresh/only-export-components` cannot be satisfied alongside
// the PascalCase fixture components below.
/* eslint-disable react-refresh/only-export-components */
import { ReactFlowProvider } from '@xyflow/react';
import { useState } from 'react';
import { useFixtureInput } from 'react-cosmos/client';
import { loadData, type ProductId, type RecipeId } from '../loadJsonData';
import RecipeNodeView from './RecipeNodeView';
import SpaceStationNodeView from './SpaceStationNodeView';
import { DEFAULT_ZONE_MODIFIERS } from '../../../context/zoneModifiers';

// Visual check for SpaceStation and Launch nodes.
// SpaceStation renders a +/- level stepper. The active level resolves through
// SpaceStationCalculator using the regime's base + (level - regime.minLevel) × delta.
// Launch nodes look like a plain recipe node — they scale continuously per-minute.

const { recipes } = loadData();

function StationFixture({ initialLevel, width = 700, rpGoal }: { initialLevel: number; width?: number; rpGoal?: number }) {
  const [flipped, setFlipped] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [level, setLevel] = useState(initialLevel);
  const zoomLevel = useFixtureInput('Zoom Level', 0)[0] as 0 | 1 | 2 | 3;
  const scaleVal = useFixtureInput('Zoom Scale', 1)[0];
  const goals = rpGoal !== undefined
    ? [{ productId: 'Product_Virtual_SpaceResearchPoints' as ProductId, qty: rpGoal, type: 'gt' as const }]
    : [];

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
        <SpaceStationNodeView
          recipe={recipe}
          inputEdges={inputEdges}
          outputEdges={outputEdges}
          solution={{ solved: true, runCount: 1 }}
          ltr={!flipped}
          zoomLevel={zoomLevel}
          onFlip={() => setFlipped(!flipped)}
          onRemove={() => setRemoved(true)}
          spaceStationOptions={{ level }}
          setOptions={(opts) => setLevel(opts.level)}
          modifiers={DEFAULT_ZONE_MODIFIERS}
          goals={goals}
        />
      </div>
    </ReactFlowProvider>
  );
}

function LaunchFixture({ recipeId, runCount, width = 600 }: { recipeId: string; runCount: number; width?: number }) {
  const [flipped, setFlipped] = useState(false);
  const zoomLevel = useFixtureInput('Zoom Level', 0)[0] as 0 | 1 | 2 | 3;

  const recipe = recipes.get(recipeId as RecipeId);
  if (!recipe) {
    return <div style={{ color: 'red', padding: 20 }}>Recipe `{recipeId}` not found. Run `npm run formatData`.</div>;
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
}

export default {
  'SpaceStation — Level 1 (basic regime)': () => <StationFixture initialLevel={1} />,
  'SpaceStation — Level 2 (basic + 1×delta)': () => <StationFixture initialLevel={2} />,
  'SpaceStation — Level 3 (advanced base, RP=48)': () => <StationFixture initialLevel={3} />,
  'SpaceStation — Level 5 (advanced + 2×delta, RP=144)': () => <StationFixture initialLevel={5} />,
  'SpaceStation — Level 8 (advanced + 5×delta)': () => <StationFixture initialLevel={8} />,
  'SpaceStation — L3 with unmeetable RP goal (warning)': () => <StationFixture initialLevel={3} rpGoal={200} />,
  'SpaceStation — L3 with achievable RP goal (no warning)': () => <StationFixture initialLevel={3} rpGoal={48} />,
  'Launch — 1 rocket/min': () => <LaunchFixture recipeId="Launch_SpaceStationParts1_T1" runCount={1} />,
  'Launch — 0.75 rockets/min (continuous)': () => <LaunchFixture recipeId="Launch_SpaceStationParts1_T1" runCount={0.75} />,
  'Launch — 6.25 rockets/min (high demand)': () => <LaunchFixture recipeId="Launch_SpaceStationParts1_T1" runCount={6.25} />,
};
