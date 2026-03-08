import fuzzysort from 'fuzzysort';

import { ListBulletIcon, TableCellsIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import type { GameDataParsed, Product } from "~/factory/graph/loadJsonData";
import { productIcon } from "~/uiUtils";
import { SelectorDialog } from "./Dialog";
import { useProductionZoneStore } from '~/context/ZoneContext';

type ProductSelectorProps = {
  isOpen: boolean,
  setIsOpen: (open: boolean) => void,
  products: GameDataParsed["products"],
  onSelect: (product: Product) => void,
};

export default function ProductSelector({ isOpen, setIsOpen, products, onSelect }: ProductSelectorProps) {
  const newProductDisplayMode = useProductionZoneStore(state => state.productDisplayMode);
  const setNewProductDisplayMode = useProductionZoneStore(state => state.setProductDisplayMode);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const productList = products.values().toArray()
    .filter(p => p.recipes.input.length + p.recipes.output.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const results = fuzzysort.go(searchTerm, productList, { key: 'name', all: true });
  const resultsMapped = results.map(r => r.obj);

  return <SelectorDialog title={"Select Product to make"}
    isOpen={isOpen} setIsOpen={setIsOpen}
    widthClassName='min-w-[50vw] max-w-[90vw]'
    heightClassName='h-[90vh]'
  >
    <div className="product-select-options flex flex-row mb-2 ">
      <div className="flex-1 bg-gray-700/30 ">
        <div className="flex px-4 py-2 rounded-md border-0 overflow-hidden ">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192.904 192.904" width="16px"
            className="fill-gray-600 mr-3 rotate-90">
            <path
              d="m190.707 180.101-47.078-47.077c11.702-14.072 18.752-32.142 18.752-51.831C162.381 36.423 125.959 0 81.191 0 36.422 0 0 36.423 0 81.193c0 44.767 36.422 81.187 81.191 81.187 19.688 0 37.759-7.049 51.831-18.751l47.079 47.078a7.474 7.474 0 0 0 5.303 2.197 7.498 7.498 0 0 0 5.303-12.803zM15 81.193C15 44.694 44.693 15 81.191 15c36.497 0 66.189 29.694 66.189 66.193 0 36.496-29.692 66.187-66.189 66.187C44.693 147.38 15 117.689 15 81.193z">
            </path>
          </svg>
          <input type="text" className="w-full outline-none bg-transparent" placeholder="Search Products..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>
      <div className="shrink-1 flex-1 justify-self-end-safe content-end align-middle text-right">
        <button
          onClick={() => setNewProductDisplayMode("icons")}
          data-active={newProductDisplayMode == "icons" || null}
          className="p-2 border-1 rounded-sm cursor-pointer hover:brightness-125 bg-gray-800 border-gray-500 data-active:brightness-120 mr-1">
          <TableCellsIcon className="w-4 inline" /> Icons
        </button>
        <button
          data-active={newProductDisplayMode == "names" || null}
          onClick={() => setNewProductDisplayMode("names")}
          className="p-2 border-1 rounded-sm cursor-pointer hover:brightness-125 bg-gray-800 border-gray-500 data-active:brightness-120">
          <ListBulletIcon className="w-4 inline" /> List
        </button>
      </div>
    </div>
    {newProductDisplayMode == "icons" &&
      <div className="grid grid-cols-[repeat(auto-fit,minmax(50px,4fr))] gap-2 overflow-y-auto">
        {resultsMapped.map((item) => {
          return (<div key={item.id} className="">
            <div id={"tooltip-" + item.id} role="tooltip" className="absolute z-10 invisible inline-block px-3 py-2 text-sm font-medium text-white transition-opacity duration-300 bg-gray-900 rounded-lg shadow-xs opacity-0 tooltip dark:bg-gray-700">
              {item.name}
              <div className="tooltip-arrow" data-popper-arrow></div>
            </div>
            <button
              data-tooltip-target={"tooltip-" + item.id}
              style={{ borderColor: item.color }}
              className={"cursor-pointer bg-transparent hover:bg-gray-700 hover:border-2  p-2 hover:p-1 rounded block"}
              onClick={() => onSelect(item)}
            ><img src={productIcon(item.icon)} title={item.name} className="inline-block w-12" />
            </button>
          </div>)
        })}
      </div>
    } {newProductDisplayMode == "names" &&
      <div className="grid grid-cols-3 gap-2 gap-x-4 overflow-y-auto">
        {resultsMapped.map((item) => {
          return (<div key={item.id} className="">
            <button
              style={{ borderColor: item.color }}
              className={"w-full text-left border-1 border-transparent hover:border-gray-500 rounded p-2 hover:bg-gray-700 cursor-pointer"}
              onClick={() => onSelect(item)}
            >
              <img src={productIcon(item.icon)} title={item.name} className="inline-block align-middle mr-2 w-8" />
              <span className="align-middle">{item.name}</span>
            </button>
          </div>)
        })}
      </div>
    }
  </SelectorDialog>
}
