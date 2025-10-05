import { XMarkIcon } from "@heroicons/react/24/outline";
import { CheckIcon, InboxArrowDownIcon, PlusIcon } from "@heroicons/react/24/solid";
import { useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { FactoryProvider } from "~/context/FactoryProvider";
import useProductionZone, { useProductionZoneStore } from "~/context/ZoneContext";
import { ProductionZoneProvider } from "~/context/ZoneProvider";
import { loadData } from "~/factory/graph/loadJsonData";
import { useStableParam } from "~/routes";
import { machineIcon, productIcon, uiIcon } from "~/uiUtils";
import { Factory } from "../factory/factory";
import useFactory from "~/factory/FactoryContext";
import FactoryControls from "~/context/FactoryControls";


// eslint-disable-next-line react-refresh/only-export-components
export function meta() {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

const { products, machines } = loadData();

export default function Home() {
  const selectedZone = useStableParam("zone");

  console.log('Home render zone', selectedZone);

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

  return useMemo(() => <>
    <ProductionZoneProvider zoneId={selectedZone || "default"}>
      <main className="h-[100vh] flex flex-col w-[100vw] overflow-hidden bg-gray-500">
        <div className="max-w-[100vw] p-2 px-12">
          Factory Planner - Zones Dropdown
        </div>
        <div className="flex-1 flex flex-row h-full">

          <Zone />
        </div>
        {images.map((img, idx) => (
          <link key={idx} rel="preload" href={img} as="image" />
        ))}
      </main >
    </ProductionZoneProvider>
  </>, [selectedZone, images]);
}

function Zone() {
  const selectedFactoryId = useStableParam("factory");

  if (!selectedFactoryId) throw new Error("No factory selected");
  const baseWeights = useProductionZoneStore(state => state.weights);
  const factories = useProductionZoneStore(state => state.factories);
  const selectedFactory = factories.find(f => f.id === selectedFactoryId);
  const idb = useProductionZone().idb;

  return useMemo(() => <>
    <FactoryProvider idb={idb} id={selectedFactoryId} name={selectedFactory?.name || "Default"} weights={baseWeights}>
      <div className="shrink-1 h-full">
        <FactoriesSideBar />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="factoryActions flex flex-row w-full h-10 bg-black">
          <FactoryControls />
        </div>

        <Factory />
      </div>
      <Outlet />
    </FactoryProvider >
  </>, [selectedFactoryId, baseWeights]);
}

function FactoriesSideBar() {
  const nav = useNavigate();
  const selectedFactory = useFactory().id;
  const zoneId = useProductionZone().id;

  const factories = useProductionZoneStore(state => state.factories);
  // const selectedId = useProductionZoneStore(state => state.selected);
  console.log('Header render', { selectedFactory, factories });
  const changeTab = (e: React.MouseEvent<unknown, MouseEvent>, id: string) => {
    nav(`/zones/${zoneId}/${id}`);
    e.preventDefault();
  }
  const addNewFactory = useProductionZoneStore(state => state.newFactory);

  const [expanded, setExpanded] = useState<boolean>(false);
  const [inputNewName, setInputNewName] = useState<boolean>(false);

  const [newName, setNewName] = useState<string>("");
  const newFactory = () => {
    addNewFactory(newName || "New Factory");
    setNewName("");
    setInputNewName(false);
  };

  return useMemo(() => <header
    data-expanded={expanded || null}
    className="group h-full w-12 transition-[width] data-expanded:w-60 
    border-r-2 border-black
    flex flex-col shrink-0">

    <div className="factoryTabs w-full overflow-hidden ">
      <button
        className="h-10 ml-1 block cursor-pointer text-xl text-bold text-center w-full mb-1 border-b-1 border-gray-700" onClick={() => {
          console.log('Toggle expanded from', expanded, 'to', !expanded);
          setExpanded(!expanded);
        }}>
        {expanded ? "<" : ">"}
      </button>
      <ul className="ml-1 flex flex-col gap-1 text-center">
        <li className="p-1 bg-black flex flex-row justify-center-safe gap-4 text-white group-data-expanded:text-left
        border-2 border-black border-r-0 border-double rounded-l
        ">
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
            : <span onClick={() => setInputNewName(true)}
              className="h-full cursor-pointer text-gray-400 hover:text-white">
              <PlusIcon className="w-6" />
            </span>
          }
          {expanded &&
            <button className="text-xs text-gray-400 cursor-pointer"><InboxArrowDownIcon className="w-6" /></button>
          }
        </li>
        {factories.map(f => (
          <li key={f.id} className="">
            <a
              data-is-selected={f.id == selectedFactory || null}
              className="block p-3 bg-black rounded-l text-gray-500 text-center
                overflow-ellipsis whitespace-nowrap
                border-2 border-black border-r-0 border-double hover:text-white
                data-is-selected:border-amber-500 data-is-selected:text-white
                data-is-selected:bg-black data-is-selected:cursor-default
                "
              onClick={(e) => changeTab(e, f.id)}
              href={`/factories/${f.id}`}>
              {expanded ? f.name : f.name.slice(0, 1)}</a>
          </li>)
        )}

      </ul>
    </div>

  </header>, [factories, selectedFactory, inputNewName, newName, expanded]);
}
