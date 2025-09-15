import { CheckIcon } from "@heroicons/react/24/solid";
import { use, useState } from "react";
import { FactoryProvider } from "~/factory/FactoryProvider";
import useProductionMatrix, { useProductionMatrixStore } from "~/factory/MatrixContext";
import { Factory } from "../factory/factory";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect } from "react";
import { loadData } from "~/factory/graph/loadJsonData";
import { machineIcon, productIcon, uiIcon } from "~/uiUtils";


// eslint-disable-next-line react-refresh/only-export-components
export function meta() {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

const { products, machines } = loadData();

export default function Home() {
  const selectedId = useProductionMatrixStore(state => state.selected);

  const [images, setImages] = useState<string[]>([]); 
  useEffect(() => {
    const newImg = Array.from(products.values().map(p => productIcon(p.icon)));
    newImg.push(...Array.from(machines.values().map(m => machineIcon(m))));
    newImg.push(uiIcon("Worker"));
    newImg.push(uiIcon("Electricity"));
    newImg.push(uiIcon("Workers"));
    newImg.push(uiIcon("Computing"));
    newImg.push(uiIcon("Maintenance"));
    setImages(newImg);
  }, [products, machines]); 
  return <>
    <main className="h-[100vh]">
      <FactoryProvider id={selectedId}>
        <div className="flex flex-col justify-stretch h-full">
          <Header/>

          <Factory />
        </div>
      </FactoryProvider>
      {images.map((img, idx) => (
        <link key={idx} rel="preload" href={img} as="image" />
      ))}
    </main >
  </>
}

function Header() {
  const factories = useProductionMatrixStore(state => state.factories);
  const selectedId = useProductionMatrixStore(state => state.selected);
  
  const changeTab = useProductionMatrixStore(state => state.changeTab);
  const addNewFactory = useProductionMatrixStore(state => state.newFactory);

  const [inputNewName, setInputNewName] = useState<boolean>(false);

  const [newName, setNewName] = useState<string>("");
  const newFactory = () => {
    addNewFactory(newName || "New Factory");
    setNewName("");
    setInputNewName(false);
  };

  return <header className="w-full bg-gray-800">
    <div className="max-w-[100vw] p-4">
      Factory
    </div>
    <div className="factoryTabs relative w-full h-15 overflow-hidden ">
      <ul className="flex flex-row gap-2 min-h-10 bottom-0 left-2 absolute w-[100vw] max-h-18 overflow-x-auto">
        {factories.map(f => (
          <li key={f.id}
            onClick={() => changeTab(f.id)}
            data-is-selected={f.id == selectedId || null}
            className="p-2 bg-black rounded-t text-white 
            border-0 border-double border-amber-500 hover:bg-gray-600 cursor-pointer 
            data-is-selected:border-2 data-is-selected:border-b-0
            data-is-selected:hover:bg-black data-is-selected:cursor-default
            ">
            {f.name}
          </li>)
        )}
        <li className="p-2 bg-black rounded-t text-white">
          {inputNewName
            ? <form className="flex flex-row gap-1" onSubmit={newFactory}>
              <XMarkIcon onClick={() => {
                setInputNewName(false);
                setNewName("");
              }} className="h-6 w-6 text-red-500 inline-block cursor-pointer" />
              <input
                type="text"
                className="bg-gray-700 text-white rounded w-40 px-2"
                value={newName}
                onChange={e => {
                  console.log('change', e.target.value)

                  setNewName(e.target.value);
                }}
              />
              <CheckIcon onClick={() => newFactory()} className="h-6 w-6 text-green-500 inline-block cursor-pointer" />
            </form>
            : <span onClick={() => setInputNewName(true)} className="cursor-pointer text-gray-400 hover:text-white">
              {"+"}
            </span>
          }
        </li>
      </ul>
    </div>

  </header>
}
