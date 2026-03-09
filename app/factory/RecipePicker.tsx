import { ChevronDownIcon, ClockIcon, PlusIcon } from "@heroicons/react/24/solid";
import { useMemo, useState } from "react";
import { formatNumber, machineIcon, productIcon } from "~/uiUtils";
import { loadData, type ProductId, type Recipe, type RecipeId } from "./graph/loadJsonData";
import { getRecipesByProduct } from "~/gameData/utils";
import { prepareRecipesForSearch, searchRecipes, groupRecipesByTier, createMatchedTermsMap } from "./recipeSearch";
import HelpLink from "~/components/HelpLink";
import { useProductionZoneStore } from '~/context/ZoneContext';

const { products } = loadData();
const MAX_DISPLAY_ITEMS = 6;

export default function RecipePicker({
  productId,
  productIs = "output",
  selectRecipe,
}: {
  productId: ProductId;
  productIs?: "input" | "output" | "any";
  selectRecipe: (recipeId: RecipeId, isBalancer: boolean) => void;
}) {
  const [tiersOpen, setTiersOpen] = useState<{ [key: string]: boolean }>({});
  const [searchTerm, setSearchTerm] = useState<string>("");
  const contractProfitability = useProductionZoneStore(state => state.modifiers.contractProfitability);

  const product = products.get(productId);
  if (!product) {
    console.error('Product not found:', productId);
    return <div className="text-red-500">Product not found</div>;
  }

  const direction = productIs === "any" ? "both" : productIs;
  const recipesList = getRecipesByProduct(productId, direction);

  if (recipesList.length === 0) {
    return <div className="text-gray-500">No recipes available for {product.name} {productIs !== "any" ? `as an ${productIs}` : ""}</div>;
  }

  const maxInputs = Math.min(Math.max(...recipesList.map(recipe => recipe.inputs.length)), MAX_DISPLAY_ITEMS);
  const maxOutputs = Math.min(Math.max(...recipesList.map(recipe => recipe.outputs.length)), MAX_DISPLAY_ITEMS);

  const recipesWithSearchTerms = useMemo(() => prepareRecipesForSearch(recipesList), [recipesList]);
  const { matchedRecipes, unmatchedRecipes, balancerRecipe } = useMemo(
    () => searchRecipes(recipesWithSearchTerms, searchTerm),
    [recipesWithSearchTerms, searchTerm]
  );
  const matchedRecipesByLinkId = useMemo(() => groupRecipesByTier(matchedRecipes), [matchedRecipes]);
  const unmatchedRecipesByLinkId = useMemo(() => groupRecipesByTier(
    unmatchedRecipes.map(r => ({ recipe: r, matchedTerms: new Set<string>() }))
  ), [unmatchedRecipes]);
  const matchedTermsMap = useMemo(() => createMatchedTermsMap(matchedRecipes), [matchedRecipes]);
  const hasActiveSearch = searchTerm.trim().length > 0;
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
    <div className="flex flex-row justify-between gap-2 items-center-safe mb-2">

      <div className="flex-1 bg-gray-700/30 ">
        <div className="flex px-4 py-2 rounded-md border-0 overflow-hidden">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192.904 192.904" width="16px"
            className="fill-gray-600 mr-3 rotate-90">
            <path
              d="m190.707 180.101-47.078-47.077c11.702-14.072 18.752-32.142 18.752-51.831C162.381 36.423 125.959 0 81.191 0 36.422 0 0 36.423 0 81.193c0 44.767 36.422 81.187 81.191 81.187 19.688 0 37.759-7.049 51.831-18.751l47.079 47.078a7.474 7.474 0 0 0 5.303 2.197 7.498 7.498 0 0 0 5.303-12.803zM15 81.193C15 44.694 44.693 15 81.191 15c36.497 0 66.189 29.694 66.189 66.193 0 36.496-29.692 66.187-66.189 66.187C44.693 147.38 15 117.689 15 81.193z">
            </path>
          </svg>
          <input type="text" className="w-full outline-none bg-transparent" placeholder="Search by product name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>
    </div>
    <table className="recipe-list min-w-[50vw] mx-auto border-spacing-y-1 border-separate text-sm"><tbody>
      {balancerRecipe && (
        <tr className="group/row recipe-row cursor-pointer"
          onClick={() => selectRecipe(balancerRecipe!.id, true)}>
          <td className="recipe-machine">
            <div className="flex flex-row gap-2 border-r-2 border-gray-600">
              <div className="flex-5">
                <img src={machineIcon(balancerRecipe.machine)} alt={balancerRecipe.machine.name || "Balancer"}
                  className="justify-self-center-safe max-w-15" />
                {balancerRecipe.machine.name}
              </div>
            </div>
          </td>
          <td colSpan={maxInputCells + maxOutputCells + 1} className="text-center text-gray-300 text-sm">
            <span className="italic">Import / Export / Balance</span>
            <span className="inline-block ml-2 align-middle" onClick={(e) => e.stopPropagation()}>
              <HelpLink topic="balancer" title="Learn about balancers" iconSize="w-4 h-4" />
            </span>
          </td>
        </tr>
      )}
      {matchedRecipesByLinkId.values().map(recipeGroup => {
        const parentMatch = recipeGroup[0];

        const isOpen = tiersOpen[parentMatch.recipe.tiersLink || parentMatch.recipe.id] || false;

        return (<>
          <RecipeRow key={parentMatch.recipe.id} recipe={parentMatch.recipe}
            maxInputCells={maxInputCells} maxOutputCells={maxOutputCells}
            selectRecipe={selectRecipe} setOpen={setOpen}
            matchedTerms={matchedTermsMap.get(parentMatch.recipe.id)} hasActiveSearch={hasActiveSearch}
            isParent={true} isOpen={isOpen} groupCount={recipeGroup.length}
            contractProfitability={contractProfitability} />

          {isOpen && recipeGroup.slice(1).map(match => (
            <RecipeRow key={match.recipe.id} recipe={match.recipe}
              maxInputCells={maxInputCells} maxOutputCells={maxOutputCells}
              selectRecipe={selectRecipe} setOpen={setOpen}
              matchedTerms={matchedTermsMap.get(match.recipe.id)} hasActiveSearch={hasActiveSearch}
              isParent={false} groupCount={recipeGroup.length}
              contractProfitability={contractProfitability} />
          ))}
        </>);
      })}
      {hasActiveSearch && unmatchedRecipesByLinkId.size > 0 && (<>
        <tr><td colSpan={maxInputCells + maxOutputCells + 3} className="text-center text-gray-500 py-2 border-t border-gray-600">
          Non-matching recipes
        </td></tr>
        {unmatchedRecipesByLinkId.values().map(recipeGroup => {
          const parentMatch = recipeGroup[0];
          const isOpen = tiersOpen[parentMatch.recipe.tiersLink || parentMatch.recipe.id] || false;

          return (<>
            <RecipeRow key={parentMatch.recipe.id} recipe={parentMatch.recipe}
              maxInputCells={maxInputCells} maxOutputCells={maxOutputCells}
              selectRecipe={selectRecipe} setOpen={setOpen}
              matchedTerms={undefined} hasActiveSearch={hasActiveSearch}
              isParent={true} isOpen={isOpen} groupCount={recipeGroup.length}
              contractProfitability={contractProfitability} />

            {isOpen && recipeGroup.slice(1).map(match => (
              <RecipeRow key={match.recipe.id} recipe={match.recipe}
                maxInputCells={maxInputCells} maxOutputCells={maxOutputCells}
                selectRecipe={selectRecipe} setOpen={setOpen}
                matchedTerms={undefined} hasActiveSearch={hasActiveSearch}
                isParent={false} groupCount={recipeGroup.length}
                contractProfitability={contractProfitability} />
            ))}
          </>);
        })}
      </>)}
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
  matchedTerms?: Set<string>;
  hasActiveSearch: boolean;
  contractProfitability: number;
  setOpen: (linkId: string, isOpen: boolean) => void;
  selectRecipe: (recipeId: RecipeId, isBalancer: boolean) => void;
};

function CompactItemList({ items, type, isMatch, contractProfitability }: {
  items: Recipe['inputs'] | Recipe['outputs'];
  type: 'input' | 'output';
  isMatch: (name: string) => boolean | undefined;
  contractProfitability?: number;
}) {
  return (
    <div className="flex flex-wrap gap-1 justify-center items-end py-1">
      {items.map((item) => {
        const matched = isMatch(item.product.name);
        const qty = type === 'output' && contractProfitability !== undefined
          ? item.quantity * contractProfitability : item.quantity;
        const isOptional = type === 'output' && 'optional' in item && item.optional;
        return (
          <div key={item.product.id}
            className="has-tooltip relative text-center min-w-8"
            data-matched={matched || null}
          >
            <span className='tooltip rounded shadow-lg p-1 border border-gray-500 bg-gray-900 -top-4 left-1/2 -translate-x-1/2 text-nowrap z-100'>
              {item.product.name}{isOptional ? ' (optional)' : ''}
            </span>
            <img src={productIcon(item.product.icon)} alt={item.product.name}
              className={`block mx-auto max-w-7 transition-opacity data-[matched=false]:opacity-30 ${isOptional ? 'border-2 border-dashed border-gray-500' : ''}`}
              data-matched={matched} />
            <span className="text-xs">{formatNumber(qty, item.product.unit)}</span>
          </div>
        );
      })}
    </div>
  );
}

function RecipeRow({ recipe, maxInputCells, maxOutputCells, selectRecipe, groupCount, isOpen, isParent, setOpen, matchedTerms, hasActiveSearch, contractProfitability }: RecipeRowProps) {
  const isCompactInputs = recipe.inputs.length > MAX_DISPLAY_ITEMS;
  const isCompactOutputs = recipe.outputs.length > MAX_DISPLAY_ITEMS;

  const outputCells = isCompactOutputs ? 0 : Math.max((recipe.outputs.length * 2) - 1, 0);
  const inputCells = isCompactInputs ? 0 : Math.max((recipe.inputs.length * 2) - 1, 0);
  const prefixInputCells = isCompactInputs ? [] : Array(maxInputCells - inputCells).fill(<td />);
  const suffixOutputCells = isCompactOutputs ? [] : Array(maxOutputCells - outputCells).fill(<td />);

  const isMatch = (productName: string) => !hasActiveSearch || matchedTerms?.has(productName);

  // For recipes with many inputs, render a compact colSpan cell
  const inputs = isCompactInputs
    ? [<td key="compact-inputs" colSpan={maxInputCells} className="text-center">
        <CompactItemList items={recipe.inputs} type="input" isMatch={isMatch} />
      </td>]
    : prefixInputCells.concat(recipe.inputs.map((input, index) => {
        const matched = isMatch(input.product.name);
        return (<>
          {index !== 0 && <td className="w-6"><PlusIcon /></td>}
          <td key={input.product.id} className="has-tooltip relative" data-matched={matched || null}>
            <span className='tooltip rounded shadow-lg p-1 border-1 border-gray-500 bg-gray-900 -top-4 left-1/2 -translate-x-1/2 text-nowrap'>{input.product.name}</span>
            <img src={productIcon(input.product.icon)} alt={input.product.name}
              className="block mb-2 mx-auto max-w-10 transition-opacity data-[matched=false]:opacity-30" data-matched={matched} />
            {formatNumber(input.quantity, input.product.unit)}
          </td>
        </>);
      }));

  // For recipes with many outputs, render a compact colSpan cell
  const outputs = isCompactOutputs
    ? [<td key="compact-outputs" colSpan={maxOutputCells} className="text-center">
        <CompactItemList items={recipe.outputs} type="output" isMatch={isMatch} contractProfitability={recipe.type === 'contract' ? contractProfitability : undefined} />
      </td>]
    : recipe.outputs.map((output, index) => {
        const matched = isMatch(output.product.name);
        const outputQty = recipe.type === 'contract' ? output.quantity * contractProfitability : output.quantity;
        return (<>
          {index !== 0 && <td className="w-6"><PlusIcon /></td>}

          <td data-optional={output.optional ? true : null}
            key={output.product.id}
            className="group has-tooltip relative data-optional:italic"
          >
            <span className='z-100 tooltip rounded shadow-lg p-1 border-1 border-gray-500 bg-gray-900 -top-4 left-1/2 -translate-x-1/2 text-nowrap'>
              {output.product.name + (output.optional ? " (optional)" : "")}
            </span>
            <img src={productIcon(output.product.icon)} alt={output.product.name}
              className="block mx-auto mb-2 max-w-10 group-data-optional:border-2 border-dashed border-gray-500 transition-opacity data-[matched=false]:opacity-30" data-matched={matched} />
            {formatNumber(outputQty, output.product.unit)}
          </td>
        </>);
      }).concat(suffixOutputCells);

  return (<tr className="group/row recipe-row cursor-pointer"
    data-is-open={isOpen} data-isParent={isParent} data-hasGroup={groupCount > 1}
    onClick={() => {
      selectRecipe(recipe.id, false);
    }} key={recipe.id}>
    <td className="recipe-machine ">
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
