import { TrashIcon } from '@heroicons/react/24/outline';
import { useStore, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import equal from 'fast-deep-equal';
import { memo, useCallback, useLayoutEffect, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useFactoryStore } from '../FactoryContext';
import BalancerNodeView from './BalancerNodeView';
import { loadData, type ProductId } from './loadJsonData';
import { type RecipeNodeData, type RecipeNodeType } from './recipeNodeLogic';
import RecipeNodeView from './RecipeNodeView';
import SettlementNodeView from './SettlmentNodeView';
import { useProductionZoneStore } from '~/context/ZoneContext';

const { recipes } = loadData();

// Re-export types for other files that need them
export type { RecipeNodeData };
export type RecipeNode = RecipeNodeType;

type ProductEdges = Map<ProductId, boolean>;

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
  
  // Select all stable actions in a single subscription
  const { removeNode, setNodeData, setRecipeNodeOptions, onNodesChange, setSettlementOptions } = useFactoryStore(
    useShallow(state => ({
      removeNode: state.removeNode,
      setNodeData: state.setNodeData,
      setRecipeNodeOptions: state.setRecipeNodeOptions,
      onNodesChange: state.onNodesChange,
      setSettlementOptions: state.setSettlementOptions,
    }))
  );
  
  // Derived state that depends on props.id
  const nodePosition = useFactoryStore(state => state.nodes.find(n => n.id === props.id)?.position);
  const alignToDrop = props.data.alignToDrop;
  const highlight = useFactoryStore(useShallow(state => state.highlight));

  // whenever we toggle collapsed, re‐measure _after_ layout
  useLayoutEffect(() => {
    updateNodeInternals(props.id);
  }, [props.data.ltr, props.id, updateNodeInternals]);

  useLayoutEffect(() => {
    // Run only for nodes that were created from a drag/drop gesture with a pending
    // target alignment request, and only once we know the current node position.
    if (!alignToDrop || !nodePosition) return;
    // Guard SSR/tests: this effect measures DOM geometry and needs the browser.
    if (typeof window === 'undefined') return;

    // Cancellation flag prevents late rAF callbacks from mutating state after unmount
    // or after dependencies change.
    let cancelled = false;
    // Retry counter for transient DOM timing (React Flow node/handles may not exist
    // on the first frame after insertion).
    let attempts = 0;

    const tryAlign = () => {
      console.log(`Attempting to align node ${props.id} to drop position (attempt ${attempts + 1}) with alignToDrop:`, alignToDrop);
      // Short-circuit work when this alignment request is no longer valid.
      if (cancelled || !alignToDrop) return;

      // Resolve the node element first; if React Flow has not painted it yet, retry
      // next frame instead of failing immediately.
      const nodeEl = document.querySelector(`.react-flow__node[data-id="${props.id}"]`) as HTMLElement | null;
      if (!nodeEl) {
        attempts += 1;
        if (attempts < 6) {
          requestAnimationFrame(tryAlign);
        } else {
          // Give up after bounded retries so we don't loop forever.
          console.warn(`Failed to find node element for alignment after ${attempts} attempts:`, props.id);
          setNodeData(props.id, { alignToDrop: undefined });
        }
        return;
      }

      // Preferred fast path: exact product+side handle (avoids nearest-handle search).
      const handleSelector = `.react-flow__handle[data-handleid="${alignToDrop.productId}"]` +
        `.${alignToDrop.handleType === 'input' ? 'target' : 'source'}`;
      const handleEl = nodeEl.querySelector(handleSelector) as HTMLElement | null;

      if (!handleEl) {
        console.warn(`Failed to find handle element for alignment using selector "${handleSelector}":`, props.id, nodeEl);
        // Defensive guard: no handle means nothing to align to.
        setNodeData(props.id, { alignToDrop: undefined });
        return;
      }

      // Read viewport transform so we can convert flow coordinates to current screen
      // coordinates under pan/zoom.
      const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement | null;
      if (!viewportEl) {
        // Without viewport transform we cannot do a reliable coordinate conversion.
        setNodeData(props.id, { alignToDrop: undefined });
        return;
      }

      // Flow transform is relative to the React Flow container, while
      // getBoundingClientRect() gives absolute screen coordinates.
      // Include container offset so both values share the same coordinate space.
      const flowContainerEl = nodeEl.closest('.react-flow') as HTMLElement | null;
      if (!flowContainerEl) {
        setNodeData(props.id, { alignToDrop: undefined });
        return;
      }
      const flowContainerRect = flowContainerEl.getBoundingClientRect();

      const transform = viewportEl.style.transform;
      const translateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
      const scaleMatch = transform.match(/scale\(([^)]+)\)/);
      const translateX = translateMatch ? parseFloat(translateMatch[1]) : 0;
      const translateY = translateMatch ? parseFloat(translateMatch[2]) : 0;
      const zoom = scaleMatch ? parseFloat(scaleMatch[1]) : 1;

      // `alignToDrop` is stored in flow space; convert to screen space to compare
      // against measured DOM handle centers.
      const dropScreen = {
        x: alignToDrop.x * zoom + translateX + flowContainerRect.left,
        y: alignToDrop.y * zoom + translateY + flowContainerRect.top,
      };

      // Optional orientation heuristic: flip node direction if the drop location implies
      // the opposite left/right side relative to the source handle. This avoids routing
      // a connection across the node after creation.
      if (alignToDrop.sourceHandleX !== undefined) {
        // Prefer explicit source handle type when available; otherwise infer from
        // the new-node handle side (new input => source was output, and vice-versa).
        const sourceHandleType = alignToDrop.sourceHandleType
          ?? (alignToDrop.handleType === 'input' ? 'output' : 'input');
        const shouldFlip = sourceHandleType === 'output'
          ? alignToDrop.x < alignToDrop.sourceHandleX
          : alignToDrop.x > alignToDrop.sourceHandleX;
        const desiredLtr = !shouldFlip;

        if (desiredLtr !== props.data.ltr) {
          console.log(`Flipping node ${props.id} to ${desiredLtr ? 'LTR' : 'RTL'} based on drop position relative to source handle`);
          // Flip first, then retry next frame so handle geometry reflects the new layout.
          setNodeData(props.id, { ltr: desiredLtr });
          requestAnimationFrame(tryAlign);
          return;
        }
      }

      // Measure chosen handle center in screen space.
      const handleRect = handleEl.getBoundingClientRect();
      const handleCenter = {
        x: handleRect.x + handleRect.width / 2,
        y: handleRect.y + handleRect.height / 2,
      };

      // Convert screen-space offset back to flow-space delta so node position update
      // is correct regardless of zoom level.
      const deltaFlow = {
        x: (dropScreen.x - handleCenter.x) / zoom,
        y: (dropScreen.y - handleCenter.y) / zoom,
      };

      // Apply a single position change that moves the chosen handle onto the original
      // drop location.
      onNodesChange([{
        id: props.id,
        type: 'position',
        position: {
          x: nodePosition.x + deltaFlow.x,
          y: nodePosition.y + deltaFlow.y,
        },
        dragging: false,
      }]);

      // One-shot behavior: clear request so future renders do not keep re-aligning.
      setNodeData(props.id, { alignToDrop: undefined });
    };

    // Defer first measurement to next frame so DOM/layout has settled.
    requestAnimationFrame(tryAlign);

    return () => {
      // Prevent stale callback from touching state after cleanup.
      cancelled = true;
    };
  }, [alignToDrop, nodePosition, props.data.ltr, props.id, onNodesChange, setNodeData]);

  const flipNode = useCallback(() => {
    setNodeData(props.id, { ltr: !props.data.ltr });
  }, [props.id, props.data.ltr, setNodeData]);

  const connectedEdges = useFactoryStore(useShallow(state => state.edges.filter(e => e.source === props.id || e.target === props.id)));
  const zoomLevel = useStore(zoomSelector);
  const modifiers = useProductionZoneStore(state => state.modifiers);

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

  const { inputEdges, outputEdges } = useMemo(() => {
    const inputEdges: ProductEdges = new Map();
    const outputEdges: ProductEdges = new Map();
    recipe.inputs.forEach(input => inputEdges.set(input.product.id, false));
    recipe.outputs.forEach(output => outputEdges.set(output.product.id, false));
    connectedEdges.forEach(edge => {
      if (edge.source === props.id) {
        // This node is the source → product is an output
        const prodId = edge.sourceHandle as ProductId | undefined;
        if (prodId && outputEdges.has(prodId)) {
          outputEdges.set(prodId, true);
        } else {
          throw new Error("Edge connected to recipe node with unknown output product ID: " + edge.sourceHandle);
        }
      } else {
        // This node is the target → product is an input
        const prodId = edge.targetHandle as ProductId | undefined;
        if (prodId && inputEdges.has(prodId)) {
          inputEdges.set(prodId, true);
        } else {
          throw new Error("Edge connected to recipe node with unknown input product ID: " + edge.targetHandle);
        }
      }
    });
    return { inputEdges, outputEdges };
  }, [recipe, connectedEdges, props.id]);

  return useMemo(() => {
    let contents;
    if (props.data.type === "balancer") {
      contents = <BalancerNodeView
        recipe={recipe}
        inputEdges={inputEdges}
        outputEdges={outputEdges}
        ltr={!!props.data.ltr}
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
        inputEdges={inputEdges}
        outputEdges={outputEdges}
        ltr={!!props.data.ltr}
        zoomLevel={zoomLevel}
        onFlip={flipNode}
        onRemove={() => removeNode(props.id)}
        solution={props.data.solution}
        highlight={highlight}
        nodeId={props.id}
        modifiers={modifiers}
      />;
    } else {
      contents = <RecipeNodeView
        recipe={recipe}
        inputEdges={inputEdges}
        outputEdges={outputEdges}
        ltr={!!props.data.ltr}
        zoomLevel={zoomLevel}
        onFlip={flipNode}
        onRemove={() => removeNode(props.id)}
        solution={props.data.solution}
        highlight={highlight}
        nodeId={props.id}
        nodeOptions={props.data.type === 'recipe' ? props.data.options : undefined}
        setOptions={opts => {
          setRecipeNodeOptions(props.id, opts);
          updateNodeInternals(props.id);
        }}
        modifiers={modifiers}
      />;
    }
    return contents;
  }, [props.data, props.data.solution, recipe, inputEdges, outputEdges, zoomLevel, highlight, props.id, modifiers]);

}

export default memo(RecipeNode, (prevProps, nextProps) => {
  // Only re-render if the node data has changed
  return equal(prevProps.data, nextProps.data);
});

