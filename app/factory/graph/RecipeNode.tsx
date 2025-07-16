import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { memo, useEffect, useState } from 'react';
import { loadProductData, loadRecipeData, type RecipeId } from './loadJsonData';
import { useFactory } from '../FactoryProvider';
import { TrashIcon } from '@heroicons/react/24/outline';

let LANG = "en-GB";

const recipeData = loadRecipeData();
const productData = loadProductData();

export type RecipeNodeData = {
  solution?: {
    solved: true,
    // Mult for the recipe
    runCount: number,
  } | {
    solved: false
  },
  recipeId: RecipeId; // Unique identifier for the recipe
};

const handleStyle: React.CSSProperties = { width: "auto", height: "auto", position: "relative", top: "initial", transform: "initial", left: "initial", right: "initial", bottom: "initial", border: 'none', backgroundColor: 'transparent' }

export type RecipeNode = Node<RecipeNodeData>;

function RecipeNode(props: NodeProps<RecipeNode>) {
  const recipe = recipeData[props.data.recipeId];

  useEffect(() => {
    if (typeof window !== undefined)
      LANG = window.navigator.language;
  }, []);

  const solution = props.data.solution;
  let mult = 1;
  if (solution?.solved && solution.runCount !== undefined) {

    mult = solution.runCount;
  }
  const getQuantityDisplay = (qty: number) => {
    return (qty * mult).toLocaleString(LANG, { maximumFractionDigits: 1 });
  }
  const removeNode = useFactory().useStore(state => state.removeNode);
  return (
    <div className="recipe-node min-w-10 min-h-20 relative p-2 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md">
      <div className="recipe-node-title-bar flex justify-between">
        <div className="flex-10 justify-start">{recipe.name}</div>
        <div className="flex-1 justify-end-safe text-right"><button onClick={() => removeNode(props.id)}>
          <TrashIcon className='w-6 text-red-700'/>  
        </button></div>
      </div>
      <div className="products flex flex-row justify-between mt-4">
        <div className="recipe-inputs flex-2 items-start relative -left-8">
          {recipe.inputs.map((input, index) => {
            const product = productData[input.id];

            return (<div className="recipe-input flex gap-1 mb-4" key={input.id} >
              <Handle type="target" position={Position.Left} id={input.id} style={handleStyle} className="flex-1 max-w-8 align-middle text-center">
                <img src={'/assets/products/' + product.icon} alt={product.name} className="pointer-events-none inline max-w-8" />
              </Handle>
              <div className="text-xs min-w-4 p-2 bg-blue-950 hover:bg-blue-700">
                {getQuantityDisplay(input.quantity)}
              </div>
            </div>);
          })}
        </div>
        <div className="recipe-outputs flex-2 items-end relative -right-16 ">
          {recipe.outputs.map((output, index) => {
            const product = productData[output.id];

            return (<div className="recipe-output flex gap-1 mb-4" key={output.id} >

              <div className="text-xsmin-w-4 p-2 bg-blue-950 hover:bg-blue-700">{getQuantityDisplay(output.quantity)}</div>
              <Handle
                type="source"
                position={Position.Right}
                id={output.id}
                style={handleStyle}

                className="flex-1 max-w-8 align-middle text-center">
                <img src={'/assets/products/' + product.icon} alt={product.name} className="pointer-events-none flex-1 max-w-8" />
              </Handle>
            </div>);
          })}
        </div>
      </div>
    </div>

  );
}

export default memo(RecipeNode);

