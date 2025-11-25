import { TrashIcon } from '@heroicons/react/24/outline';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/solid';
import { Handle, Position, useStore, useUpdateNodeInternals, type Node, type NodeProps } from '@xyflow/react';
import equal from 'fast-deep-equal';
import { memo, useLayoutEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { formatNumber, machineIcon, maintenanceIcon, maintenanceName, productBackground, productIcon, uiIcon } from '~/uiUtils';
import { useFactoryStore } from '../FactoryContext';
import { loadData, type ProductId, type Recipe, type RecipeId } from './loadJsonData';
import type { ButtonEdge } from './edges/ButtonEdge';

const { recipes } = loadData();

export type RecipeNodeData = {
  solution?: {
    solved: true,
    // Mult for the recipe
    runCount: number,
  } | {
    solved: false
  },
  recipeId: RecipeId; // Unique identifier for the recipe
  ltr?: boolean; // Left to right layout
};

const handleStyle: React.CSSProperties = { width: "auto", height: "auto", position: "initial", transform: "initial", border: 'none', backgroundColor: 'transparent' }

export type RecipeNode = Node<RecipeNodeData>;

const getQuantityDisplay = (quantity: number, runCount: number, unit: string) => {
  const amount = quantity * runCount;

  return formatNumber(amount, unit);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const zoomSelector = (s: any) => s?.transform?.[2] <= 0.2;

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
  const runCount = props.data.solution?.solved ? props.data.solution.runCount : 1;

  return (
    <div className="recipe-node min-w-10 min-h-20 relative p-2 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md">
      <div className="recipe-node-title-bar flex justify-between border-white/20 mb-8 pb-2 border-b-2 items-center-safe ">
        <div className="flex-1 text-left p-1">
          <button
            title="Flip Direction"
            className="cursor-pointer text-white/50 hover:text-white/80 hover:bg-gray-500/50 p-1 rounded"
            onClick={() => flipNode()}>
            <ArrowsRightLeftIcon className={`transition-[scale] duration-200 inline-block w-6 ${props.data.ltr ? "" : "scale-x-[-1]"}`} />
          </button>
        </div>
        <div className="flex-10 text-center text-xl">{recipe.machine.name}</div>
        <div className="flex-1 justify-end-safe text-right ">
          <button
            className="cursor-pointer text-red-500/50 hover:text-white/80 hover:bg-red-500/50 p-1 rounded"
            onClick={() => removeNode(props.id)}>
            <TrashIcon className='w-6' />
          </button>
        </div>
      </div>

      <div className="products flex flex-row gap-2 text-xl justify-between mt-4">
        <HandleList data={props.data} products={props.data.ltr ? recipe.inputs : recipe.outputs}
          pos={Position.Left} inputs={props.data.ltr} productEdges={productEdges} />
        {!isFarZoom &&
          <div className="recipe-machine flex-2 flex-col items-center text-center min-w-30">
            <img src={machineIcon(recipe.machine)} alt={recipe.machine.name}
              className="inline-block w-20 min-w-8 p-1 pointer-events-none
          bg-gray-400/10 shadow-md/20 rounded-lg data-flipped:scale-x-[-1]
          " data-flipped={props.data.ltr == false || null} />
            <div className="w-full my-1 text-2xl">{formatNumber(runCount, "", runCount < 10 ? 3 : 1)}</div>

          </div>
        }
        <HandleList data={props.data} products={props.data.ltr ? recipe.outputs : recipe.inputs}
          pos={Position.Right} inputs={!props.data.ltr} productEdges={productEdges} />

      </div>
      <div className="recipe-node-infra-bar flex justify-start align-start gap-2 border-white/20 pt-4 mb-1 pb-0 border-t-2">
        <InfrastructureIcon name="Electricity Used" icon={uiIcon("Electricity")}
          amount={getQuantityDisplay(recipe.machine.electricity_consumed, runCount, "kW") /*TODO:: Modify by recipe? */} />
        <InfrastructureIcon name={`Workers (${recipe.machine.workers}) x ${Math.ceil(runCount)}`} icon={uiIcon("Worker")}
          amount={getQuantityDisplay(recipe.machine.workers, Math.ceil(runCount) /* TODO:: Is this correct? Do workers get consumed even when the building is idle */, "")} />
        <InfrastructureIcon name={maintenanceName(recipe.machine)} icon={maintenanceIcon(recipe.machine)}
          amount={getQuantityDisplay(recipe.machine.maintenance_cost?.quantity || 0, runCount, "")} />
        <InfrastructureIcon name="Computing Used" icon={uiIcon("Computing")}
          amount={getQuantityDisplay(recipe.machine.computing_consumed, runCount, "TFlops")} />
        <InfrastructureIcon name={`Tile Footprint (${recipe.machine.footprint?.[0]} x ${recipe.machine.footprint?.[1]}) x ${Math.ceil(runCount)}`} icon={uiIcon("Move128")} iconClassName="rotate-45 scale-120"
          amount={getQuantityDisplay(recipe.machine.footprint?.reduce((a, i) => a *= i, 1) || 0, Math.ceil(runCount), "")} />
      </div>
    </div>
  );
}

function InfrastructureIcon({ name, icon, amount, iconClassName }: { name: string, icon: string, amount: string, iconClassName?: string }) {
  return (
    <div data-zero={amount.startsWith("0 ") ? true : null} className="flex-1 text-center text-xl text-gray-400 data-zero:opacity-20 data-zero:grayscale">
      <div className="h-8">
        <img src={icon} className={"h-full mx-auto " + iconClassName} title={name} />
      </div>
      <div className="text-nowrap">{amount}</div>
    </div>
  );
}

type ProductEdges = Map<ProductId, ButtonEdge | null>;
type HandleListProps = {
  data: RecipeNodeData,
  products: Recipe["inputs" | "outputs"],
  pos: Position,
  inputs: boolean
  productEdges: ProductEdges
}

function HandleList({ data, products, pos, inputs, productEdges }: HandleListProps) {
  const ltr = <T extends string, U extends string>(left: T, right: U) => pos === Position.Left ? left : right;
  const inOrOut = <T extends string, U extends string>(input: T, output: U) => inputs ? input : output;

  return (
    <div className={
      `recipe-${inOrOut("inputs", "outputs")} 
        recipe-list
        flex-2 relative 
        ${ltr("items-start -left-2", "justify-end-safe -right-2")}`
    }>
      {products.map(prod => {
        const isConnected = productEdges.get(prod.product.id) !== null;
        const productColor = productBackground(prod.product);

        const handle = <Handle type={inOrOut("target", "source")}
          position={pos}
          id={prod.product.id}
          style={handleStyle}
          className="handle py-2 text-center">
          <img data-optional={prod.optional ? true : null} src={productIcon(prod.product.icon)} alt={prod.product.name}
            className="drop-shadow-md/30 pointer-events-none block max-w-8 
            data-optional:p-0.5 data-optional:box-content data-optional:border-1 border-dashed border-gray-400 border-0
          " />
          <div
            style={{
              backgroundColor: productColor,
              borderColor: productColor,
            }}
            className={"clipped hidden pointer-events-none w-6 top-0 h-[101%] absolute border-1 " + ltr("-left-5", "-right-5") + " " + inOrOut(ltr("", "scale-x-[-1]"), ltr("scale-x-[-1]", ""))}
          ></div>
        </Handle>

        return (<div style={{ backgroundColor: productColor }}
          className={`recipe-${inOrOut("input", "output")} recipe-handle text-nowrap relative ${ltr("pl-2", "pr-2")} flex mb-4 items-center-safe`}
          key={prod.product.id}
          data-connected={isConnected}
        >
          {pos === Position.Left ? handle : null}
          <div className="flex-1 min-w-4 p-2 text-shadow-md/50">
            {getQuantityDisplay(prod.quantity, data.solution?.solved ? data.solution.runCount : 1, prod.product.unit)}
          </div>
          {pos === Position.Left ? null : handle}
        </div>);
      })}
    </div>
  );
}

export default memo(RecipeNode, (prevProps, nextProps) => {
  // Only re-render if the node data has changed
  return equal(prevProps.data, nextProps.data);
});

