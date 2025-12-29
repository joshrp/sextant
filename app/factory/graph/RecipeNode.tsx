import { useStore, useUpdateNodeInternals, type Node, type NodeProps } from '@xyflow/react';
import equal from 'fast-deep-equal';
import { memo, useLayoutEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { useFactoryStore } from '../FactoryContext';
import { loadData, type ProductId } from './loadJsonData';
import type { ButtonEdge } from './edges/ButtonEdge';
import { getRunCount, type RecipeNodeData } from './recipeNodeLogic';
import RecipeNodeView from './RecipeNodeView';
import { TrashIcon } from '@heroicons/react/24/outline';

const { recipes } = loadData();

// Re-export RecipeNodeData for other files that need it
export type { RecipeNodeData };

export type RecipeNode = Node<RecipeNodeData>;

type ProductEdges = Map<ProductId, ButtonEdge | null>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const zoomSelector = (s: any) => s?.transform?.[2] <= 0.2;

// TODO: Component Testing - Refactored for testability:
// ✅ DONE: Extracted pure logic functions to recipeNodeLogic.ts (getQuantityDisplay, getRunCount)
// ✅ DONE: Added unit tests for extracted logic in recipeNodeLogic.test.ts
// ✅ DONE: Extracted pure RecipeNodeView component to separate file for isolated testing
// ✅ DONE: Created component tests for RecipeNodeView (RecipeNodeView.component.test.tsx)
// ✅ DONE: Created Cosmos fixtures for RecipeNodeView (RecipeNodeView.fixture.tsx)
// 
// REMAINING WORK for full component testing:
// 1. Consider extracting HandleList sub-component if needed for additional reuse
// 2. Consider extracting InfrastructureIcon sub-component if needed for additional reuse
// 3. Add visual regression tests for different zoom levels and orientations if needed
// 
// Note: RecipeNode wrapper handles React Flow and Zustand context integration.
// RecipeNodeView is a pure component that can be tested in isolation.
function RecipeNode(props: NodeProps<RecipeNode>) {
  const updateNodeInternals = useUpdateNodeInternals();
  if (props.data.ltr === undefined) props.data.ltr = true; // Default to left-to-right layout

  // whenever we toggle collapsed, re‐measure _after_ layout
  useLayoutEffect(() => {
    updateNodeInternals(props.id);
  }, [props.data.ltr, props.id, updateNodeInternals]);

  const removeNode = useFactoryStore(state => state.removeNode);
  const setNodeData = useFactoryStore(state => state.setNodeData);
  const flipNode = () => {
    setNodeData(props.id, { ltr: !props.data.ltr });
  };

  const connectedEdges = useFactoryStore(useShallow(state => state.edges.filter(e => e.source === props.id || e.target === props.id)));
  const isFarZoom = useStore(zoomSelector);

  const recipe = recipes.get(props.data.recipeId);
  if (!recipe) {
    return <div className="recipe-node min-w-10 min-h-20 relative p-2 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md">
      <div className="recipe-node-title-bar flex justify-between border-white/20 mb-8 pb-2 border-b-2 items-center-safe ">
        <div className="flex-1 text-left p-1">
        </div>
        <div className="flex-10 text-center text-xl">Recipe Not Found</div>
        <div className="flex-1 justify-end-safe text-right ">
          <button
            className="cursor-pointer text-red-500/50 hover:text-white/80 hover:bg-red-500/50 p-1 rounded"
            onClick={() => removeNode(props.id)}>
            <TrashIcon className='w-6' />
          </button>
        </div>
      </div>
      <div className="text-center text-red-500">Error: Recipe ID `{props.data.recipeId}` not found.</div>

    </div>;
  }

  const productEdges: ProductEdges = new Map();
  recipe.inputs.forEach(input => productEdges.set(input.product.id, null));
  recipe.outputs.forEach(output => productEdges.set(output.product.id, null));
  connectedEdges.forEach(edge => {
    const prodId = edge.sourceHandle as ProductId | undefined;
    if (prodId && productEdges.has(prodId)) {
      productEdges.set(prodId, edge as ButtonEdge);
    } else {
      throw new Error("Edge connected to recipe node with unknown product ID: " + edge.sourceHandle);
    }
  });
  const runCount = getRunCount(props.data);

  return (
    <RecipeNodeView
      recipe={recipe}
      runCount={runCount}
      productEdges={productEdges}
      ltr={props.data.ltr}
      isFarZoom={isFarZoom}
      onFlip={flipNode}
      onRemove={() => removeNode(props.id)}
      solution={props.data.solution}
    />
  );
}

export default memo(RecipeNode, (prevProps, nextProps) => {
  // Only re-render if the node data has changed
  return equal(prevProps.data, nextProps.data);
});

