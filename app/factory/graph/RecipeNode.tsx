import { TrashIcon } from '@heroicons/react/24/outline';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/solid';
import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from '@xyflow/react';
import { memo, useLayoutEffect } from 'react';
import { formatNumber, machineIcon, productBackground, productIcon } from '~/uiUtils';
import { useFactoryStore } from '../FactoryContext';
import { loadData, type Recipe, type RecipeId, type RecipeProduct } from './loadJsonData';
import equal from 'fast-deep-equal';

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

const handleStyle: React.CSSProperties = { width: "auto", height: "auto", position: "initial",  transform: "initial", border: 'none', backgroundColor: 'transparent' }

export type RecipeNode = Node<RecipeNodeData>;

const getQuantityDisplay = (recipeProd: RecipeProduct, runCount: number) => {
  const amount = recipeProd.quantity * runCount;

  return formatNumber(amount, recipeProd.product.unit);
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
  const flipNode = () => {
    setNodeData(props.id, { ltr: !props.data.ltr });
  };

  const recipe = recipes.get(props.data.recipeId);
  if (!recipe) {
    console.error("Recipe not found for id:", props.data.recipeId);
    return <div className="recipe-node-error">Recipe not found</div>;
  }

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
        <HandleList data={props.data} products={props.data.ltr ? recipe.inputs : recipe.outputs} pos={Position.Left} inputs={props.data.ltr} />
        <div className="recipe-machine flex-2 flex-col items-center text-center min-w-30">
          <img src={machineIcon(recipe.machine)} alt={recipe.machine.name}
            className="inline-block w-20 min-w-8 p-1 pointer-events-none
          bg-gray-400/10 shadow-md/20 rounded-lg
          " />
          <div className="w-full mt-1"><span className="text-sm">x</span> {formatNumber(runCount)}</div>

        </div>
        <HandleList data={props.data} products={props.data.ltr ? recipe.outputs : recipe.inputs} pos={Position.Right} inputs={!props.data.ltr} />

      </div>
    </div>

  );
}

function HandleList({ data, products, pos, inputs }: { data: RecipeNodeData, products: Recipe["inputs" | "outputs"], pos: Position, inputs: boolean }) {
  const ltr = <T extends string, U extends string>(left: T, right: U) => pos === Position.Left ? left : right;
  const inOrOut = <T extends string, U extends string>(input: T, output: U) => inputs ? input : output;

  return (
    <div className={
      `recipe-${inOrOut("inputs", "outputs")} 
      flex-2 relative 
      ${ltr("items-start -left-2", "justify-end-safe -right-2")}`}>

      {products.map(prod => {

        const productColor = productBackground(prod.product);
        const clipPath = inOrOut(
          "polygon(0 0, 100% 0, 100% 100%, 0 100%, 70% 50%)",
          "polygon(0 0, 40% 0, 100% 50%, 40% 100%, 0 100%)"
        );
        const handle = <Handle type={inOrOut("target", "source")}
          position={pos}
          id={prod.product.id}
          style={handleStyle}
          className="py-2 text-center">
          <img src={productIcon(prod.product.icon)} alt={prod.product.name}
            className="drop-shadow-md/30 pointer-events-none block max-w-8" />
          <div
            style={{
              backgroundColor: productColor,
              borderColor: productColor,
              clipPath
            }}
            className={"pointer-events-none w-6 top-0 h-[101%] absolute border-1 " + ltr("-left-5", "-right-5") + " " + inOrOut(ltr("", "scale-x-[-1]"), ltr("scale-x-[-1]", "")) }
          ></div>
        </Handle>

        return (<div style={{ backgroundColor: productColor }}
          className={`recipe-${inOrOut("input", "output")} text-nowrap relative ${ltr("pl-2","pr-2")} flex mb-4 items-center-safe`}
          key={prod.product.id}
        >
          {pos === Position.Left ? handle : null}
          <div className="flex-1 min-w-4 p-2 text-shadow-md/50">
            {getQuantityDisplay(prod, data.solution?.solved ? data.solution.runCount : 1)}
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

