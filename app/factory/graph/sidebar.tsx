import { memo } from 'react';
import { loadProductData, type ProductId, type ProductData } from './loadJsonData';
import { PlusIcon } from '@heroicons/react/24/solid';
import type { FactorySettings } from '../FactoryProvider';
// import { useStore } from '@xyflow/react';

// const transformSelector = (state: any) => state.transform;
const items = loadProductData();

type props = {
  selectAProduct: () => void;
  outputs: FactorySettings["desiredOutputs"]
};

function SideBar({ selectAProduct, outputs }: props) {
  // const transform = useStore(transformSelector);
  
  return (
    <div className='sidebar h-full p-2 border-r-2 border-dotted border-gray-300 dark:border-gray-700'>
      <div className="title">Outputs</div>
      <div className="bg-gray-800 grid-holder p-2 ">
        {}
        <button onClick={selectAProduct} className="cursor-pointer bg-gray-700 rounded hover:bg-gray-900 focus:bg-gray-900 active:bg-gray-900 ">
          <div className="inline-flex text-center w-8 align-middle">
            <PlusIcon/>
          </div>
        </button>

      </div>
    </div>
  );
};

export default memo(SideBar);
