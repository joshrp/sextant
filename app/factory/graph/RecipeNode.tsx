import { TrashIcon } from '@heroicons/react/24/outline';
import { useStore, useUpdateNodeInternals, type Node, type NodeProps } from '@xyflow/react';
import equal from 'fast-deep-equal';
import { memo, useLayoutEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { useFactoryStore } from '../FactoryContext';
import { loadData, type ProductId } from './loadJsonData';
import { type BalancerNodeData, type RecipeNodeData, type SettlementNodeData } from './recipeNodeLogic';
import RecipeNodeView from './RecipeNodeView';
import BalancerNodeView from './BalancerNodeView';
import SettlementNodeView from './SettlmentNodeView';

const { recipes } = loadData();

// Re-export RecipeNodeData for other files that need it
export type { RecipeNodeData };

export type RecipeNode = Node<RecipeNodeData | BalancerNodeData | SettlementNodeData>;

type ProductEdges = Map<ProductId, boolean | null>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const zoomSelector = (s: any) => {
  const zoom = s?.transform?.[2];
  if (zoom === undefined || zoom === null || zoom > 0.28) return 0;
  if (zoom > 0.2) {
    return 1;
  } else if (zoom > 0.12) {
    return 2;
  } else {
    return 3;
  }
}

function RecipeNode(props: NodeProps<RecipeNode>) {
  const updateNodeInternals = useUpdateNodeInternals();
  if (props.data.ltr === undefined) props.data.ltr = true; // Default to left-to-right layout

  // whenever we toggle collapsed, re‐measure _after_ layout
  useLayoutEffect(() => {
    updateNodeInternals(props.id);
  }, [props.data.ltr, props.id, updateNodeInternals]);

  const removeNode = useFactoryStore(state => state.removeNode);
  const setNodeData = useFactoryStore(state => state.setNodeData);
  const setSettlementOptions = useFactoryStore(state => state.setSettlementOptions);
  const highlight = useFactoryStore(useShallow(state => state.highlight));
  const flipNode = () => {
    setNodeData(props.id, { ltr: !props.data.ltr });
  };

  const connectedEdges = useFactoryStore(useShallow(state => state.edges.filter(e => e.source === props.id || e.target === props.id)));
  const zoomLevel = useStore(zoomSelector);

  const recipe = 'recipeId' in props.data && recipes.get(props.data.recipeId);
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
      <div className="text-center text-red-500">Error: Recipe ID `{'recipeId' in props.data ? props.data.recipeId : "unknown"}` not found.</div>

    </div>;
  }

  const productEdges: ProductEdges = new Map();
  recipe.inputs.forEach(input => productEdges.set(input.product.id, false));
  recipe.outputs.forEach(output => productEdges.set(output.product.id, false));
  connectedEdges.forEach(edge => {
    const prodId = edge.sourceHandle as ProductId | undefined;
    if (prodId && productEdges.has(prodId)) {
      productEdges.set(prodId, true);
    } else {
      throw new Error("Edge connected to recipe node with unknown product ID: " + edge.sourceHandle);
    }
  });

  let contents;
  if (props.data.type === "balancer") {
    contents = <BalancerNodeView
      recipe={recipe}
      productEdges={productEdges}
      ltr={props.data.ltr}
      zoomLevel={zoomLevel}
      onFlip={flipNode}
      onRemove={() => removeNode(props.id)}
      solution={props.data.solution}
      highlight={highlight}
      nodeId={props.id}
    />;
  } else if (props.data.type === "settlement") {
    contents = <SettlementNodeView
      recipe={recipe}
      settlementOptions={props.data.options}
      setOptions={options => setSettlementOptions(props.id, options)}
      productEdges={productEdges}
      ltr={props.data.ltr}
      zoomLevel={zoomLevel}
      onFlip={flipNode}
      onRemove={() => removeNode(props.id)}
      solution={props.data.solution}
      highlight={highlight}
      nodeId={props.id}
    />;
  } else {
    contents = <RecipeNodeView
      recipe={recipe}
      productEdges={productEdges}
      ltr={props.data.ltr}
      zoomLevel={zoomLevel}
      onFlip={flipNode}
      onRemove={() => removeNode(props.id)}
      solution={props.data.solution}
      highlight={highlight}
      nodeId={props.id}

    />;
  }
  return contents;
}

export default memo(RecipeNode, (prevProps, nextProps) => {
  // Only re-render if the node data has changed
  return equal(prevProps.data, nextProps.data);
});

