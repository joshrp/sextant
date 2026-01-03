import { Button, Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ChevronDownIcon, ChevronRightIcon, PencilSquareIcon, XMarkIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { CheckIcon, InboxArrowDownIcon, PencilIcon, PlusIcon } from "@heroicons/react/24/solid";
import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router";

import FactoryEditDialog from "~/components/FactoryEditDialog";
import FactoryControls from "~/context/FactoryControls";
import { FactoryProvider } from "~/context/FactoryProvider";
import usePlanner, { usePlannerStore } from "~/context/PlannerContext";
import useProductionZone, { useProductionZoneStore } from "~/context/ZoneContext";
import { ProductionZoneProvider } from "~/context/ZoneProvider";
import { loadData } from "~/factory/graph/loadJsonData";
import { useStableParam } from "~/routes";
import { machineIcon, productIcon, uiIcon } from "~/uiUtils";
import { Factory } from "../factory/factory";

// eslint-disable-next-line react-refresh/only-export-components
export function meta() {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

const { products, machines } = loadData();
interface InlineStringEditorProps {
  onSubmit: (value: string) => void;
  onCancel: () => void;
  initialValue?: string;
  checkValue?: (value: string) => boolean; // Return true if valid
  placeholder?: string;
}

export function InlineStringEditor({
  initialValue,
  onSubmit,
  onCancel,
  checkValue,
  placeholder = ""
}: InlineStringEditorProps) {
  const [value, setValue] = useState<string>(initialValue || "");
  const isTaken = checkValue ? checkValue(value) : false;

  return <form className="flex flex-row gap-1 align-baseline" onSubmit={() => onSubmit(value)}>
    <XMarkIcon onClick={onCancel} className="h-6 w-6 text-red-300 inline-block cursor-pointer" />
    <input type="text"
      data-is-taken={isTaken || null}
      placeholder={placeholder}
      className="bg-gray-700 text-white rounded w-40 px-2 data-is-taken:bg-red-700"
      value={value}
      onChange={e => {
        setValue(e.target.value);
      }}
    />
    <CheckIcon data-is-taken={isTaken} onClick={() => onSubmit(value)}
      className="h-6 w-6 text-green-500 inline-block data-[is-taken=false]:cursor-pointer data-[is-taken=true]:text-gray-800" />
  </form>
}
export default function Home() {
  const selectedZone = useStableParam("zone");
  const zones = usePlannerStore(state => state.zones);
  const zone = zones.find(z => z.id === selectedZone);
  const setLastZone = usePlannerStore(state => state.setLastZone);

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

  // Update last used zone whenever zone changes
  useEffect(() => {
    if (zone) {
      setLastZone(selectedZone);
    }
  }, [selectedZone, zone, setLastZone]);

  return <>
    <main className="h-[100vh] w-[100vw] overflow-hidden bg-gray-800">
      <div className="max-w-[100vw] h-10 p-2 ml-10 flex flex-row gap-4 items-center text-gray-300">
        <ZoneHeader selectedZone={selectedZone} />
      </div>
      {zone && (
        <ProductionZoneProvider zoneId={selectedZone} zoneName={zone.name}>
          <div className="h-[calc(100vh-calc(10*var(--spacing)))] flex flex-row">
            <Zone />
          </div>
        </ProductionZoneProvider>
      )}
      {!zone && (selectedZone === "") &&
        <div className="flex-1 flex flex-col justify-center-safe items-center-safe bg-zinc-950">
          <h2 className="text-2xl mb-4">No Zone Selected</h2>
          <p>Please select or create a zone</p>
        </div>
      }
      {!zone && (selectedZone !== "") &&
        <div className="flex-1 flex flex-col justify-center-safe items-center-safe bg-zinc-950">
          <h2 className="text-2xl mb-4">Zone Not Found</h2>
          <p>The selected zone &quot;{selectedZone}&quot; was not found.</p>
        </div>
      }
      {images.map((img, idx) => (
        <link key={idx} rel="preload" href={img} as="image" />
      ))}
    </main >
  </>
}

function ZoneHeader({ selectedZone }: { selectedZone?: string }) {
  const plannerStore = usePlanner().store;
  const zones = usePlannerStore(state => state.zones);
  const zone = zones.find(z => z.id === selectedZone);

  const newZoneAction = usePlannerStore(state => state.newZone);

  const [renameZoneId, setRenameZoneId] = useState<string>("");
  const [inputNewName, setInputNewName] = useState<boolean>(false);

  const checkName = (newName: string) => zones.some(z => z.name.toLowerCase() === newName.toLowerCase() && z.id !== renameZoneId);

  const nameSubmit = (name: string) => {
    if (name.trim() === "") return;
    if (renameZone) {
      plannerStore.getState().renameZone(renameZoneId, name.trim());
      setRenameZoneId("");
    } else { // New zone
      newZoneAction(name.trim());
    }
  }
  const renameZone = zones.find(z => z.id === renameZoneId);

  return (<>
    <h1 className="shrink-1 border-r-2 border-gray-400 pr-8">Factory Planner</h1>
    <h2 className="shrink-1">Zone:</h2>
    {inputNewName || renameZone
      ? <div className="inline-block">
        <InlineStringEditor initialValue={renameZone?.name}
          placeholder={renameZoneId ? "" : "Zone Name"}
          checkValue={checkName}
          onSubmit={nameSubmit}
          onCancel={() => {
            setInputNewName(false);
            setRenameZoneId("");
          }
          } />
      </div> : <>
        <Menu>
          <MenuButton className="text-white items-middle h-full px-2 shrink-1 rounded-sm bg-gray-700 cursor-pointer">
            <span>{zone?.name}</span>
            <ChevronDownIcon className="w-6 h-full inline-block ml-2 mb-1" />
          </MenuButton>
          <MenuItems anchor={"bottom start"}
            className="border-2 border-gray-400 shadow-2xl absolute rounded z-10 bg-gray-700  text-white">
            {zones.map(z => (
              <MenuItem key={z.id}>
                <div className="flex flex-row items-center-safe justify-between not-last:border-b-2  border-gray-400">
                  <Link className="flex-6 border-0 block px-2 py-1 hover:bg-gray-600" to={`/zones/${z.id}`}>
                    {z.name}
                  </Link>
                  <div className="actions p-2 inline-block shrink-1 border-l-2 border-gray-400">
                    <Button className="h-full cursor-pointer hover:text-gray-400 block" title="Edit Name"
                      onClick={() => setRenameZoneId(z.id)}>
                      <PencilIcon className="w-4 h-full" />
                    </Button>
                  </div>
                </div>
              </MenuItem>
            ))}
          </MenuItems>
        </Menu>
        <Button className="shrink-1 -mt-1 cursor-pointer hover:text-gray-700 text-white"
          title="Create New Zone"
          onClick={() => setInputNewName(true)} >
          <PencilSquareIcon className="w-5 h-full inline-block" />
        </Button>
      </>
    }
    <div className="flex-1" />
    <Link 
      to="help?topic=introduction" 
      className="shrink-1 cursor-pointer hover:text-white text-gray-400 flex items-center gap-2"
      title="Help"
    >
      <InformationCircleIcon className="w-6 h-6" />
      <span>Help</span>
    </Link>
  </>);
}

function Zone() {
  let selectedFactoryId = useStableParam("factory", "");

  const baseWeights = useProductionZoneStore(state => state.weights);
  const factories = useProductionZoneStore(state => state.factories);
  const zoneId = useProductionZone().id;
  const store = useProductionZone().store;

  if (selectedFactoryId === "") {
    if (factories.length === 0)
      selectedFactoryId = store.getState().newFactory("Default Factory");
    else
      selectedFactoryId = store.getState().lastFactory || factories[0]?.id;
    history.replaceState({}, "", `/zones/${zoneId}/${selectedFactoryId}`);
  }

  const selectedFactory = factories.find(f => f.id === selectedFactoryId);
  store.getState().setLastFactory(selectedFactoryId);
  const idb = useProductionZone().idb;

  return useMemo(() => <>
    <div className="shrink-1 h-full">
      <ZoneSideBar selectedFactoryId={selectedFactoryId} />
    </div>
    {selectedFactory &&
      <FactoryProvider idb={idb} zoneId={zoneId} id={selectedFactoryId} name={selectedFactory?.name || "Default Factory"} weights={baseWeights}>
        <div className="flex-1 flex flex-col h-full">
          <div className="factoryActions flex flex-row w-full h-10 bg-zinc-950">
            <FactoryControls />
          </div>
          <div className="justify-self-stretch flex flex-row w-full h-[calc(100%-calc(10*var(--spacing)))]">
            <Factory />
          </div>
        </div>

        <Outlet />
      </FactoryProvider >
    } {!selectedFactory &&
      <div className="h-full flex flex-col justify-center-safe items-center-safe bg-zinc-950">
        <h2 className="text-2xl mb-4">No Factory Selected</h2>
        <p>Please select a factory from the sidebar.</p>
      </div>
    }
  </>, [baseWeights, selectedFactory, idb]);
}

export function ZoneSideBar({ selectedFactoryId }: { selectedFactoryId: string }) {
  const nav = useNavigate();
  const zoneId = useProductionZone().id;

  const factories = useProductionZoneStore(state => state.factories);
  const newFactory = useProductionZoneStore(state => state.newFactory);
  const updateFactory = useProductionZoneStore(state => state.updateFactory);

  const changeTab = (e: React.MouseEvent<unknown, MouseEvent>, id: string) => {
    nav(`/zones/${zoneId}/${id}`);
    e.preventDefault();
  }

  const [expanded, setExpanded] = useState<boolean>(false);
  const [editingFactoryId, setEditingFactoryId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const editingFactory = editingFactoryId ? factories.find(f => f.id === editingFactoryId) : null;
  const existingFactoryNames = useMemo(
    () => factories.filter(f => f.id !== editingFactoryId).map(f => f.name),
    [factories, editingFactoryId]
  );

  const handleSaveFactory = (data: { name: string; icon?: string; description?: string }) => {
    if (isCreatingNew) {
      const newId = newFactory(data.name, undefined, data.icon, data.description);
      nav(`/zones/${zoneId}/${newId}`);
      setIsCreatingNew(false);
    } else if (editingFactoryId) {
      updateFactory(editingFactoryId, data);
      setEditingFactoryId(null);
    }
  };

  const handleCancelEdit = () => {
    setIsCreatingNew(false);
    setEditingFactoryId(null);
  };

  return useMemo(() => <aside
    data-expanded={expanded || null}
    className="group h-full w-12 data-expanded:w-60 
    after:content-[''] after:absolute after:top-0 after:right-0 after:h-full after:w-4
    after:shadow-[inset_-4px_0_4px_0_rgba(0,0,0,0.3)] relative z-10
    transition-[width] duration-200 ease-out
    flex flex-col shrink-0">

    <div className="factoryTabs w-full overflow-hidden flex flex-col h-full">
      <ul className="pl-1 flex flex-col gap-1 text-center flex-1">
        {/* Zone Hub Tab - Top level with prominent styling */}
        <li title="Zone Hub" className="flex flex-row justify-center-safe gap-2 p-2 
         text-white bg-zinc-950 hover:bg-zinc-800
        border-2 border-transparent border-r-0 rounded-l font-semibold
        group-data-expanded:text-left
        ">
          <svg className="
            inline-block w-6 h-6 stroke-white stroke-2 [stroke-linejoin:round] [stroke-linecap:round]
          " viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 12H21M12 8V12M6.5 12V16M17.5 12V16M10.1 8H13.9C14.4601 8 14.7401 8 14.954 7.89101C15.1422 7.79513 15.2951 7.64215 15.391 7.45399C15.5 7.24008 15.5 6.96005 15.5 6.4V4.6C15.5 4.03995 15.5 3.75992 15.391 3.54601C15.2951 3.35785 15.1422 3.20487 14.954 3.10899C14.7401 3 14.4601 3 13.9 3H10.1C9.53995 3 9.25992 3 9.04601 3.10899C8.85785 3.20487 8.70487 3.35785 8.60899 3.54601C8.5 3.75992 8.5 4.03995 8.5 4.6V6.4C8.5 6.96005 8.5 7.24008 8.60899 7.45399C8.70487 7.64215 8.85785 7.79513 9.04601 7.89101C9.25992 8 9.53995 8 10.1 8ZM15.6 21H19.4C19.9601 21 20.2401 21 20.454 20.891C20.6422 20.7951 20.7951 20.6422 20.891 20.454C21 20.2401 21 19.9601 21 19.4V17.6C21 17.0399 21 16.7599 20.891 16.546C20.7951 16.3578 20.6422 16.2049 20.454 16.109C20.2401 16 19.9601 16 19.4 16H15.6C15.0399 16 14.7599 16 14.546 16.109C14.3578 16.2049 14.2049 16.3578 14.109 16.546C14 16.7599 14 17.0399 14 17.6V19.4C14 19.9601 14 20.2401 14.109 20.454C14.2049 20.6422 14.3578 20.7951 14.546 20.891C14.7599 21 15.0399 21 15.6 21ZM4.6 21H8.4C8.96005 21 9.24008 21 9.45399 20.891C9.64215 20.7951 9.79513 20.6422 9.89101 20.454C10 20.2401 10 19.9601 10 19.4V17.6C10 17.0399 10 16.7599 9.89101 16.546C9.79513 16.3578 9.64215 16.2049 9.45399 16.109C9.24008 16 8.96005 16 8.4 16H4.6C4.03995 16 3.75992 16 3.54601 16.109C3.35785 16.2049 3.20487 16.3578 3.10899 16.546C3 16.7599 3 17.0399 3 17.6V19.4C3 19.9601 3 20.2401 3.10899 20.454C3.20487 20.6422 3.35785 20.7951 3.54601 20.891C3.75992 21 4.03995 21 4.6 21Z" />
          </svg>
          {expanded && <span className="flex-1">Zone Hub</span>}
        </li>

        {/* Factory Tabs - Indented underneath Zone Hub */}
        {factories.map(f => (
          <li key={f.id} data-is-selected={f.id == selectedFactoryId || null}

            className="flex flex-row gap-1 bg-gray-800 rounded-l text-gray-400 border-1 
                      border-gray-700 border-r-0 hover:text-white hover:bg-gray-700
                      data-is-selected:border-amber-600 data-is-selected:text-white
                      data-is-selected:bg-zinc-950 data-is-selected:cursor-default 
                      whitespace-nowrap items-center-safe
                      p-1 pr-0 justify-center relative text-left
                      shadow-[2px_0_4px_0_rgba(0,0,0,0.25)]
                      data-is-selected:shadow-none
          ">
            <Link className="flex-1 overflow-ellipsis overflow-hidden"
              onClick={(e) => changeTab(e, f.id)}
              title={f.name}
              to={`/factories/${f.id}`}>

              {f.icon && <img src={f.icon} alt="" className="inline-block w-10 group-data-expanded:w-8 group-data-expanded:mr-2 align-middle" />}
              {f.name}
            </Link>

            {expanded && <>
              <button
                onClick={() => setEditingFactoryId(f.id)}
                className="shrink-1 justify-self-end-safe -mt-1 cursor-pointer hover:text-gray-700 mr-3"
                title="Edit Factory"
              >
                <PencilIcon className="w-4 h-full inline-block" />
              </button>
            </>
            }
          </li>)
        )}

        {/* New & Import Controls */}
        <li className="p-1 mt-2 bg-gray-800 flex flex-row justify-center-safe gap-4 text-white group-data-expanded:text-left
        border-2 border-gray-700 border-r-0 rounded-l
        ml-2
        ">
          <button
            onClick={() => {
              setIsCreatingNew(true);
              setExpanded(true);
            }}
            className="h-full cursor-pointer text-gray-400 hover:text-white"
            title="New Factory">
            <PlusIcon className="w-6" />
          </button>
          {expanded &&
            <Link className="text-xs text-gray-400 hover:text-white cursor-pointer"
              to={`./settings/importexport`}
              title="Import Factory"
            >
              <InboxArrowDownIcon className="w-6" />
            </Link>
          }
        </li>

      </ul>

      {/* Expansion toggle button moved to bottom */}
      <button
        className="h-10 block cursor-pointer text-xl text-bold text-center w-full mt-auto border-t-2 border-gray-700 text-gray-400 hover:text-white"
        onClick={() => {
          setExpanded(!expanded);
        }}>
        <ChevronRightIcon className="w-6 h-6 inline-block group-data-expanded:scale-x-[-1]" />
      </button>
    </div>

    {(isCreatingNew || editingFactoryId) && (
      <FactoryEditDialog
        isOpen={true}
        factoryId={editingFactoryId || undefined}
        initialName={editingFactory?.name || ""}
        initialIcon={editingFactory?.icon}
        initialDescription={editingFactory?.description}
        existingFactoryNames={existingFactoryNames}
        onSave={handleSaveFactory}
        onCancel={handleCancelEdit}
        title={isCreatingNew ? "Create Factory" : "Edit Factory"}
      />
    )}

  </aside>, [factories, selectedFactoryId, expanded, zoneId, isCreatingNew, editingFactoryId, existingFactoryNames]);
}
