import { ClockIcon, PlusIcon } from "@heroicons/react/24/solid";
import { loadMachineData, loadProductData, loadRecipeData, type ProductId, type Recipe, type RecipeId } from "./graph/loadJsonData";

const productData = loadProductData();
const recipeData = loadRecipeData();
const machineData = loadMachineData();

export default function RecipePicker({
  productId,
  productIs = "output",
  selectRecipe,
}: {
  productId: ProductId;
  productIs?: "input" | "output" | "any";
  selectRecipe: (recipeId: RecipeId) => void;
}) {

  const product = productData[productId];
  let recipes: Recipe[] = [];
  if (productIs === "input" || productIs === "any") {
    recipes = recipes.concat(product.recipes.input.map(id => recipeData[id]));
  }
  if (productIs === "output" || productIs === "any") {
    recipes = recipes.concat(product.recipes.output.map(id => recipeData[id]));
  }

  if (!product) {
    return <div className="text-red-500">Product not found</div>;
  }

  if (recipes.length === 0) {
    return <div className="text-gray-500">No recipes available for {product.name} {productIs !== "any" ? `as an ${productIs}` : ""}</div>;
  }

  const maxInputs = Math.max(...recipes.map(recipe => recipe.inputs.length));
  const maxOutputs = Math.max(...recipes.map(recipe => recipe.outputs.length));

  // Number of columns per recipe:
  // + 1 for machine
  // + maxInputs for inputs 
  // + 1 for duration
  // + maxOutputs for outputs
  // + 1 each for the + between inputs and outputs
  // (maxInputs + maxOutputs) * 2 - 2 + 2

  const maxOutputCells = Math.max((maxOutputs * 2) - 1, 0);
  const maxInputCells = Math.max((maxInputs * 2) - 1, 0);

  return (<table className="recipe-list w-full border-spacing-y-1 border-separate text-sm"><tbody>
    {recipes.map(recipe => {
      const machine = machineData[recipe.machine];
      const outputCells = Math.max((recipe.outputs.length * 2) - 1, 0);
      const inputCells = Math.max((recipe.inputs.length * 2) - 1, 0);
      const prefixInputCells = Array(maxInputCells - inputCells).fill(<td/>);
      const suffixOutputCells = Array(maxOutputCells - outputCells).fill(<td/>);

      // prefix the inputs with empty divs to fill the grid
      const inputs = prefixInputCells.concat(recipe.inputs.map((input, index) => {
        const product = productData[input.id];
        return (<>   
          {index !== 0 && <td className="w-12"><PlusIcon/></td>}       
          <td key={input.id} className="has-tooltip">
            <span className='tooltip rounded shadow-lg p-1 border-1 bg-gray-900 -mt-8 -ml-8 text-nowrap'>{product.name}</span>
            <img src={'/assets/products/' + product.icon} alt={product.name} className="block mb-2 mx-auto max-w-[60px]" />
            {input.quantity}
          </td>
        </>);
      }));
      
      // append the outputs with empty divs to fill the grid
      const outputs = recipe.outputs.map((output, index) => {
        const product = productData[output.id];
        return (<>
          {index !== 0 && <td className="w-12"><PlusIcon/></td>}       

          <td key={output.id} className="has-tooltip">
            <span className='tooltip rounded shadow-lg p-1 border-1 bg-gray-900 -mt-8 -ml-8 text-nowrap'>{product.name}</span>
            <img src={'/assets/products/' + product.icon} alt={product.name} className="block mb-2 mx-auto max-w-[60px]" />
            {Math.round(output.quantity) !== Math.round(output.quantity) ? output.quantity?.toFixed(2) || 0 : output.quantity} 
          </td>
        </>);
      }).concat(suffixOutputCells);

    return (<tr className="recipe-row cursor-pointer" onClick={() => {
      selectRecipe(recipe.id);
    }} key={recipe.id}>
          <td className="recipe-machine max-w-30">
            <div className="flex gap-1 items-center-safe">
              <div className="flex-3">
                <img src={'/assets/buildings/' + machine.icon} alt={machine.name} className="block" />
                {machine.name}
              </div>
              <div className="flex-1 w-4">&rarr;</div>
            </div>
          </td>
          {/* Inputs, Duration, Outputs */}
          {inputs}
          <td className="recipe-duration min-w-10">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-6 inline" viewBox="0 0 10 20" fill="currentColor">
              <path fillRule="evenodd" d="m -8 5 L 11 5 L 11 3 L 14 6 L 11 9 V 7 H -8 Z" clipRule="evenodd" />
            </svg><br/>

            {recipe.duration || 60} <ClockIcon className="inline w-4 pb-1  text-gray-500" />
          </td>
          {outputs}
      </tr>)
    })}
  </tbody></table>);
}
