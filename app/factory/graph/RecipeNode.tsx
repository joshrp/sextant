import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { loadProductData, loadRecipeData, type RecipeId } from './loadJsonData';
import { useFactory } from '../FactoryProvider';

const recipeData = loadRecipeData();
const productData = loadProductData();

export type RecipeNodeData = {
  label?: string;
  recipeId: RecipeId; // Unique identifier for the recipe
};

const handleStyle: React.CSSProperties = { width: "auto", height: "auto", position: "relative", top: "initial", transform: "initial", left: "initial", right: "initial", bottom: "initial", border: 'none', backgroundColor: 'transparent' }

export type RecipeNode = Node<RecipeNodeData>;

function RecipeNode(props: NodeProps<RecipeNode>) {
  const recipe = recipeData[props.data.recipeId];
  const removeNode = useFactory().useStore(state => state.removeNode);
  return (
    <div className="recipe-node min-w-10 min-h-20 relative p-2 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md">
      <div className="">{recipe.name}<button onClick={()=>removeNode(props.id)}>Del</button></div>

      <div className="products flex flex-row justify-between mt-4">
        <div className="recipe-inputs flex-2 items-start relative -left-8">
          {recipe.inputs.map((input, index) => {
            const product = productData[input.id];

            return (<div className="recipe-input flex gap-1 mb-4" key={input.id} >
              <Handle type="target" position={Position.Left} id={input.id} style={handleStyle} className="flex-1 max-w-8 align-middle text-center">
                <div className="text-xs pointer-events-none min-w-4 p-2 bg-blue-950 hover:bg-blue-700">{input.quantity}</div>

              </Handle>
              <img src={'/assets/products/' + product.icon} alt={product.name} className="inline max-w-8" />
            </div>);
          })}
        </div>
        <div className="recipe-outputs flex-2 items-end relative -right-16 ">
          {recipe.outputs.map((output, index) => {
            const product = productData[output.id];

            return (<div className="recipe-output flex gap-1 mb-4" key={output.id} >
              <img src={'/assets/products/' + product.icon} alt={product.name} className="flex-1 max-w-8" />
              <Handle
                type="source"
                position={Position.Right}
                id={output.id}
                style={handleStyle}
                
                className="flex-1 max-w-8 align-middle text-center">

                <div className="text-xs pointer-events-none min-w-4 p-2 bg-blue-950 hover:bg-blue-700">{output.quantity}</div>
              </Handle>
            </div>);
          })}
        </div>
      </div>
    </div>

  );
}

export default memo(RecipeNode);

