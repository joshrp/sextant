import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { useFactoryStore } from "~/context/FactoryContext";
import { loadData, type ProductId } from "~/factory/graph/loadJsonData";
import type { HighlightProduct } from "~/context/store";
import { productIcon } from "~/uiUtils";

const { products, recipes } = loadData();

export function FactoryOverlayBar() {

  const currentHighlight = useFactoryStore(state => state.highlight);
  const nodes = useFactoryStore(state => state.nodes);

  const setHighlight = useFactoryStore(state => state.setHighlight);
  const getProducts = useFactoryStore(state => state.getProductsInGraph);
  if (!currentHighlight) return null;
  const productsInGraph = Array.from(getProducts() ?? new Set<ProductId>());

  const { mode } = currentHighlight;
  let setOptions: (options: HighlightProduct['options']) => void;

  if (mode === "product" && currentHighlight.productId) {
    const productId = currentHighlight.productId;
    const options = currentHighlight.options;

    setOptions = (options: HighlightProduct['options']) => {
      setHighlight({
        mode: "product",
        productId: productId,
        options: options
      });
    };
    const open = true;


    const product = products.get(productId);
    if (!product) return null;
    const productImg = productIcon(product.icon);
    const productName = product.name;

    return (<div data-open={open}
      className="absolute left-1/2 top-4 mx-auto z-[2000]
              min-w-2/5 translate-x-[-50%] data-open:opacity-100 data-open:visible
              opacity-0 invisible
            
              rounded-lg text-white border-2 border-double border-white/20
            bg-zinc-900/70 backdrop-blur-sm texture-industrial"
    >
      <div className="flex flex-row gap-2 items-center justify-center border-b-1 border-gray-500 p-2 texture-embossed">
        <div className="flex-1 justify-self-start">&nbsp;</div>
        <div className="flex-1 flex flex-row gap-2 mx-auto items-center justify-center whitespace-nowrap">
          <div className="h-full">Show:</div>
          <div className="w-8 -mr-1 border-1 border-gray-600/40 rounded p-1">
            <img src={productImg} className="h-full" title={productName} />
          </div>
          <div>{productName}</div>
          <Menu>
            <MenuButton className="text-sm cursor-pointer">
              <ChevronDownIcon className="inline h-4 w-4" />
            </MenuButton>
            <MenuItems anchor="bottom start" className="
              z-[10000] overflow-auto max-h-[50vh]
              bg-zinc-800/80 backdrop-blur-sm border border-gray-600 rounded-md shadow-lg 
            ">
            {productsInGraph.map(pid => {
              const p = products.get(pid);
              if (!p) return null;
              const img = productIcon(p.icon);
              return <MenuItem key={pid}>
                <div
                  className="flex flex-row items-center gap-2 p-2 hover:bg-zinc-700 cursor-pointer"
                  onClick={() => {
                    setHighlight({
                      mode: "product",
                      productId: pid,
                      options: currentHighlight.options
                    });
                  }}
                >
                  <img src={img} className="h-6 inline -mr-1" title={p.name} />
                  <span>{p.name}</span>
                </div>
              </MenuItem>;
            })}
            </MenuItems>
          </Menu>
        </div>
        <div className="flex-1  justify-self-end-safe items-center flex justify-end-safe">
          <button
            className="cursor-pointer text-red-500/50 hover:text-white/80 hover:bg-red-500/50 p-1 rounded"
            onClick={() => setHighlight({ mode: "none" })}>
            <XMarkIcon className='w-6' />
          </button>
        </div>
      </div>
      <div className="actions-row flex flex-row justify-stretch">
        <ProductViewOptionButton label="Inputs" active={options.inputs} onClick={() => { setOptions({ ...options, inputs: !options.inputs }) }} />
        <ProductViewOptionButton label="Outputs" active={options.outputs} onClick={() => { setOptions({ ...options, outputs: !options.outputs }) }} />
        <ProductViewOptionButton label="Connected" active={options.connected} onClick={() => { setOptions({ ...options, connected: !options.connected }) }} />
        <ProductViewOptionButton label="Unconnected" active={options.unconnected} onClick={() => { setOptions({ ...options, unconnected: !options.unconnected }) }} />
        <ProductViewOptionButton label="Lines" active={options.edges} onClick={() => { setOptions({ ...options, edges: !options.edges }) }} />
      </div>
    </div>)
  } else if (mode === "edge") {
    // Edge highlight mode
    const product = products.get(currentHighlight.sourceHandle);
    const sourceNode = nodes.find(n => n.id === currentHighlight.sourceNodeId);
    const targetNode = nodes.find(n => n.id === currentHighlight.targetNodeId);
    
    if (!product || !sourceNode || !targetNode) return null;

    const sourceRecipe = sourceNode.type === "recipe-node" ? recipes.get(sourceNode.data.recipeId) : undefined;
    const targetRecipe = targetNode.type === "recipe-node" ? recipes.get(targetNode.data.recipeId) : undefined;

    if (!sourceRecipe || !targetRecipe) return null;

    const productImg = productIcon(product.icon);
    const productName = product.name;

    return (<div data-open={true}
      className="absolute left-1/2 top-4 mx-auto z-[2000]
              min-w-2/5 translate-x-[-50%] data-open:opacity-100 data-open:visible
              opacity-0 invisible
            
              rounded-lg text-white border-2 border-double border-white/20
            bg-zinc-900/70 backdrop-blur-sm texture-industrial"
    >
      <div className="flex flex-row gap-2 items-center justify-center border-b-1 border-gray-500 p-2 texture-embossed">
        <div className="flex-1 justify-self-start">&nbsp;</div>
        <div className="flex-1 flex flex-row gap-2 mx-auto items-center justify-center whitespace-nowrap">
          <div className="h-full">Edge:</div>
          <div className="w-8 -mr-1 border-1 border-gray-600/40 rounded p-1">
            <img src={productImg} className="h-full" title={productName} />
          </div>
          <div>{productName}</div>
        </div>
        <div className="flex-1  justify-self-end-safe items-center flex justify-end-safe">
          <button
            className="cursor-pointer text-red-500/50 hover:text-white/80 hover:bg-red-500/50 p-1 rounded"
            onClick={() => setHighlight({ mode: "none" })}>
            <XMarkIcon className='w-6' />
          </button>
        </div>
      </div>
      <div className="actions-row flex flex-row justify-stretch text-sm">
        <EdgeInfoSection label="From" machineName={sourceRecipe.machine.name} />
        <div className="border-l-1 border-gray-500" />
        <EdgeInfoSection label="To" machineName={targetRecipe.machine.name} />
      </div>
    </div>)
  } else {
    return null;
  }
}

function ProductViewOptionButton(props: {
  label: string;
  onClick: () => void;
  active: boolean;
}) {
  return <div
    data-active={props.active ? true : null}
    className="h-full flex-1 flex flex-row cursor-pointer justify-center items-center-safe text-center
      py-2 px-3 transition-colors duration-100 
      text-gray-600
      not-first:border-l-1 border-gray-500 first:rounded-bl-md last:rounded-br-md
      data-active:text-white data-active:bg-zinc-800 data-active:hover:text-gray-300
      "
    onClick={props.onClick}
  >
    <div className="mr-1">
      {props.active ? <CheckIcon className="h-4" /> : <XMarkIcon className="h-4" />}
    </div>
    <div className="">
      {props.label}
    </div>
  </div>
}

function EdgeInfoSection(props: {
  label: string;
  machineName: string;
}) {
  return <div className="flex-1 flex flex-col items-center justify-center py-2 px-3 text-gray-300">
    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{props.label}</div>
    <div className="font-medium">{props.machineName}</div>
  </div>
}
