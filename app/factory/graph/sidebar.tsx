import { memo } from 'react';
import { loadProductData, type ProductId, type ProductData } from './loadJsonData';
import { PlusIcon } from '@heroicons/react/24/solid';
import { useFactory, type FactorySettings } from '../FactoryProvider';
import useStore from '../store';

// const transformSelector = (state: any) => state.transform;
const items = loadProductData();

type props = {
  selectAProduct: () => void;
  calcResults?: any;
  outputs: FactorySettings["desiredOutputs"]
};



function SideBar({ selectAProduct, outputs, calcResults }: props) {
  // const transform = useStore(transformSelector);
  const factory = useFactory().settings;
  const constraints = useStore(state => state.constraints);
  const recalc = useStore(state => state.graphChangeAction);

  return (
    <div className='sidebar h-full p-2 border-r-2 border-dotted border-gray-300 dark:border-gray-700'>
      <div className="title">Goals</div>
      <div className="bg-gray-800 
        grid-holder p-2
        grid gap-2 
         
        grid-cols-[repeat(auto-fit,minmax(40px,2fr))]">
        {factory.desiredOutputs.map(desire => {
          const fulfilled = constraints.openOutputs.findIndex(val => desire.id == val) > -1;
          return <button className={`p-2 pb-0 text-center 
                                  bg-gray-700 hover: bg-gray-900
                                    rounded cursor-pointer
                                    border-1 border-gray-500 ${fulfilled ? "bg-green-500" : "bg-red-500"}`}
                                    >
            <img className="inline-block" src={'/assets/products/' + items[desire.id].icon} />
            <span className="text-xs text-shadow-xl text-shadow-black ">{desire.qty}</span>
          </button>
        })}
        <button onClick={selectAProduct} className="cursor-pointer bg-gray-700 rounded hover:bg-gray-900 focus:bg-gray-900 active:bg-gray-900 ">
          <div className="inline-flex text-center w-8 align-middle">
            <PlusIcon />
          </div>
        </button>

      </div>
      <div className="title">Results</div>
      <div className="subtitle">Extra Outputs</div>

      <div className="bg-gray-800 
        grid-holder p-2
        grid gap-2 
        items-stetch justify-start-safe 
        grid-rows-[repeat(auto-fit,minmax(40px,50px))] 
        grid-cols-[repeat(auto-fit,minmax(40px,50px))]">
        {constraints.openOutputs.map(input => {
          return <div className="p-2 text-center bg-gray-700">
            <img className="inline-block h-full" src={'/assets/products/' + items[input].icon} />
          </div>
        })}
      </div>
      <div className="subtitle">Required Inputs</div>
            <div className="bg-gray-800 
        grid-holder p-2
        grid gap-2 
        items-stetch justify-start-safe 
        grid-rows-[repeat(auto-fit,minmax(40px,50px))] 
        grid-cols-[repeat(auto-fit,minmax(40px,50px))]">
        {constraints.openInputs.map(input => {
          return <div className="p-2 text-center bg-gray-700">
            <img className="inline-block h-full" src={'/assets/products/' + items[input].icon} />
          </div>
        })}
      </div>
      <button className="p-4 m-4 bg-blue-500 cursor-pointer" onClick={recalc}>Recalc</button>
      <div className="results w-full overflow-auto text-xs">
        <pre>{JSON.stringify(calcResults, null, 2)}</pre>
      </div>
    </div>
  );
};

export default memo(SideBar);
