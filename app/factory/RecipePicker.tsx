import { ChevronDownIcon, ClockIcon, PlusIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { formatNumber, machineIcon } from "~/uiUtils";
import { loadData, type ProductId, type Recipe, type RecipeId } from "./graph/loadJsonData";

const { products } = loadData();

export default function RecipePicker({
  productId,
  productIs = "output",
  selectRecipe,
}: {
  productId: ProductId;
  productIs?: "input" | "output" | "any";
  selectRecipe: (recipeId: RecipeId) => void;
}) {
  const [tiersOpen, setTiersOpen] = useState<{ [key: string]: boolean }>({});
  const [searchTerm, setSearchTerm] = useState<string>("");

  const product = products.get(productId);
  if (!product) {
    return <div className="text-red-500">Product not found</div>;
  }

  let recipesList: Recipe[] = [];
  if (productIs === "input" || productIs === "any") {
    recipesList = recipesList.concat(product.recipes.input);
  }
  if (productIs === "output" || productIs === "any") {
    recipesList = recipesList.concat(product.recipes.output);
  }

  if (!product) {
    return <div className="text-red-500">Product not found</div>;
  }

  if (recipesList.length === 0) {
    return <div className="text-gray-500">No recipes available for {product.name} {productIs !== "any" ? `as an ${productIs}` : ""}</div>;
  }

  const maxInputs = Math.max(...recipesList.map(recipe => recipe.inputs.length));
  const maxOutputs = Math.max(...recipesList.map(recipe => recipe.outputs.length));
  const recipesByLinkId = new Map<string, Recipe[]>();
  let balancerRecipe: Recipe | null = null as Recipe | null;
  recipesList.forEach(recipe => {
    const linkId = recipe.tiersLink || recipe.id;

    if (recipe.machine.isBalancer) {
      balancerRecipe = recipe;
      return; // skip balancers
    }

    if (recipesByLinkId.has(linkId))
      recipesByLinkId.get(linkId)!.push(recipe);
    else
      recipesByLinkId.set(linkId, [recipe]);
  });
  // Number of columns per recipe:
  // + 1 for machine
  // + maxInputs for inputs 
  // + 1 for duration
  // + maxOutputs for outputs
  // + 1 each for the + between inputs and outputs
  // (maxInputs + maxOutputs) * 2 - 2 + 2

  const maxOutputCells = Math.max((maxOutputs * 2) - 1, 0);
  const maxInputCells = Math.max((maxInputs * 2) - 1, 0);
  const setOpen = (linkId: string, isOpen: boolean) => {
    setTiersOpen(old => ({ ...old, [linkId]: isOpen }));
  };
  return (<div>
    <div className="flex flex-row justify-between gap-2 items-center-safe">
      <div>
        <input type="text" className="h-full w-full outline-none bg-transparent" placeholder="Fuzzy Search Recipes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>
      {balancerRecipe && <div>
        <button className="relative has-tooltip p-0.5 rounded-sm cursor-pointer hover:brightness-125 bg-gray-800 border-gray-500"
          onClick={() => selectRecipe(balancerRecipe!.id)}>
            <span className='tooltip z-50 rounded shadow-lg p-1 border-1 border-gray-500 bg-gray-900 -top-8 left-1/2 -translate-x-1/2 text-nowrap'>Use Import/Export/Balancer</span> 
          <img src={machineIcon(balancerRecipe?.machine)} alt={balancerRecipe?.machine.name || "Balancer"}
            className="inline-block max-w-10"
          />
        </button>
      </div>
      }
    </div>
    <table className="recipe-list min-w-[50vw] mx-auto border-spacing-y-1 border-separate text-sm"><tbody>
      {recipesByLinkId.values().map(recipeGroup => {
        const parentRecipe = recipeGroup[0]; // TODO better sort here? Fastest first? preference?

        const isOpen = tiersOpen[parentRecipe.tiersLink || parentRecipe.id] || false;

        return (<>
          <RecipeRow key={parentRecipe.id} recipe={parentRecipe}
            maxInputCells={maxInputCells} maxOutputCells={maxOutputCells}
            selectRecipe={selectRecipe} setOpen={setOpen}
            isParent={true} isOpen={isOpen} groupCount={recipeGroup.length} />

          {isOpen && recipeGroup.slice(1).map(recipe => (
            <RecipeRow key={recipe.id} recipe={recipe}
              maxInputCells={maxInputCells} maxOutputCells={maxOutputCells}
              selectRecipe={selectRecipe} setOpen={setOpen}
              isParent={false} groupCount={recipeGroup.length} />
          ))}
        </>);
      })}
    </tbody ></table>
  </div>);
}

type RecipeRowProps = {
  recipe: Recipe;
  maxInputCells: number;
  maxOutputCells: number;
  isParent?: boolean;
  isOpen?: boolean;
  groupCount: number,
  setOpen: (linkId: string, isOpen: boolean) => void;
  selectRecipe: (recipeId: RecipeId) => void;
};

function RecipeRow({ recipe, maxInputCells, maxOutputCells, selectRecipe, groupCount, isOpen, isParent, setOpen }: RecipeRowProps) {
  const outputCells = Math.max((recipe.outputs.length * 2) - 1, 0);
  const inputCells = Math.max((recipe.inputs.length * 2) - 1, 0);
  const prefixInputCells = Array(maxInputCells - inputCells).fill(<td />);
  const suffixOutputCells = Array(maxOutputCells - outputCells).fill(<td />);

  // prefix the inputs with empty divs to fill the grid
  const inputs = prefixInputCells.concat(recipe.inputs.map((input, index) => {
    return (<>
      {index !== 0 && <td className="w-6"><PlusIcon /></td>}
      <td key={input.product.id} className="has-tooltip relative">
        <span className='tooltip rounded shadow-lg p-1 border-1 border-gray-500 bg-gray-900 -top-4 left-1/2 -translate-x-1/2 text-nowrap'>{input.product.name}</span>
        <img src={'/assets/products/' + input.product.icon} alt={input.product.name}
          className="block mb-2 mx-auto max-w-10" />
        {formatNumber(input.quantity, input.product.unit)}
      </td>
    </>);
  }));

  // append the outputs with empty divs to fill the grid
  const outputs = recipe.outputs.map((output, index) => {
    return (<>
      {index !== 0 && <td className="w-6"><PlusIcon /></td>}

      <td data-optional={output.optional ? true : null}
        key={output.product.id}
        className="group has-tooltip relative data-optional:italic"
      >
        <span className='z-100 tooltip rounded shadow-lg p-1 border-1 border-gray-500 bg-gray-900 -top-4 left-1/2 -translate-x-1/2 text-nowrap'>
          {output.product.name + (output.optional ? " (optional)" : "")}
        </span>
        <img src={'/assets/products/' + output.product.icon} alt={output.product.name}
          className="block mx-auto mb-2 max-w-10 group-data-optional:border-2 border-dashed border-gray-500" />
        {formatNumber(output.quantity, output.product.unit)}
      </td>
    </>);
  }).concat(suffixOutputCells);

  return (<tr className="group/row recipe-row cursor-pointer"
    data-is-open={isOpen} data-isParent={isParent} data-hasGroup={groupCount > 1}
    onClick={() => {
      selectRecipe(recipe.id);
    }} key={recipe.id}>
    <td className="recipe-machine max-w-20">
      <div className="flex flex-row gap-2 border-r-2 border-gray-600">
        <div className="flex-5">
          <img src={machineIcon(recipe.machine)} alt={recipe.machine.name}
            className="justify-self-center-safe max-w-15" />
          {recipe.machine.name}
        </div>
        <div className="flex-1 h-full mr-2 my-auto group-data-[isParent=false]/row:hidden ">
          {recipe.tiersLink && (
            <button className="flex flex-row gap-1 p-2 bg-gray-900 rounded cursor-pointer hover:bg-gray-800" onClick={(e) => {
              e.stopPropagation();
              setOpen(recipe.tiersLink || recipe.id, !isOpen);
              return false;
            }}><span>{groupCount}</span> <ChevronDownIcon className="w-4 inline-block group-data-[is-open=true]/row:scale-y-[-1]" /></button>
          )}
        </div>
      </div>
    </td>
    {/* Inputs, Duration, Outputs */}
    {inputs}
    <td className="recipe-duration min-w-16">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-6 inline" viewBox="0 0 10 20" fill="currentColor">
        <path fillRule="evenodd" d="m -8 5 L 11 5 L 11 3 L 14 6 L 11 9 V 7 H -8 Z" clipRule="evenodd" />
      </svg><br />

      {recipe.duration || 60} <ClockIcon className="inline w-4 pb-1 text-gray-500" />
    </td>
    {outputs}
  </tr>);
}
