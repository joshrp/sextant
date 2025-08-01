import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { loadData, type RecipeId, type RecipeProduct } from './loadJsonData';
import useFactory from '../FactoryContext';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useStore } from 'zustand';
import { formatNumber } from '~/uiUtils';

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
};

const handleStyle: React.CSSProperties = { width: "auto", height: "auto", position: "relative", top: "initial", transform: "initial", left: "initial", right: "initial", bottom: "initial", border: 'none', backgroundColor: 'transparent' }

export type RecipeNode = Node<RecipeNodeData>;

function RecipeNode(props: NodeProps<RecipeNode>) {
  const recipe = recipes.get(props.data.recipeId);
  if (!recipe) {
    console.error("Recipe not found for id:", props.data.recipeId);
    return <div className="recipe-node-error">Recipe not found</div>;
  }

  const solution = props.data.solution;
  let runCount = 1;
  if (solution?.solved && solution.runCount !== undefined) {
    runCount = solution.runCount;
  }
  const getQuantityDisplay = (recipeProd: RecipeProduct) => {
    const amount = recipeProd.quantity * runCount;
      
    return formatNumber(amount, recipeProd.product.unit);;
  }
  const removeNode = useStore(useFactory().store, state => state.removeNode);
  return (
    <div className="recipe-node min-w-10 min-h-20 relative p-2 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md">
      <div className="recipe-node-title-bar flex justify-between">
        <div className="flex-10 justify-start">{recipe.name}</div>
        <div className="flex-1 justify-end-safe text-right"><button onClick={() => removeNode(props.id)}>
          <TrashIcon className='w-6 text-red-700'/>  
        </button></div>
      </div>
        <div className="w-full">x{runCount}</div>
      <div className="products flex flex-row justify-between mt-4">
        <div className="recipe-inputs flex-2 items-start relative -left-8">
          {recipe.inputs.map(input => {
            return (<div className="recipe-input flex gap-1 mb-4" key={input.product.id} >
              <Handle type="target" position={Position.Left} id={input.product.id} style={handleStyle} className="flex-1 max-w-8 align-middle text-center">
                <img src={'/assets/products/' + input.product.icon} alt={input.product.name} className="pointer-events-none inline max-w-8" />
              </Handle>
              <div className="text-xs min-w-4 p-2 bg-blue-950 hover:bg-blue-700">
                {getQuantityDisplay(input)}
              </div>
            </div>);
          })}
        </div>
        <div className="recipe-outputs flex-2 items-end relative -right-16 ">
          {recipe.outputs.map(output => {
            return (<div className="recipe-output flex gap-1 mb-4" key={output.product.id} >

              <div className="text-xs text-right min-w-4 p-2 bg-blue-950 hover:bg-blue-700">
                {getQuantityDisplay(output)}
              </div>
              <Handle
                type="source"
                position={Position.Right}
                id={output.product.id}
                style={handleStyle}

                className="flex-1 max-w-8 align-middle text-center">
                <img src={'/assets/products/' + output.product.icon} alt={output.product.name} className="pointer-events-none flex-1 max-w-8" />
              </Handle>
            </div>);
          })}
        </div>
      </div>    
    </div>

  );
}

export default memo(RecipeNode);

