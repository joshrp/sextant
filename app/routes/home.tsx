import { Button, Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ChevronDownIcon, PencilSquareIcon, XMarkIcon } from "@heroicons/react/24/outline";
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
    <main className="h-[100vh] w-[100vw] overflow-hidden bg-gray-500">
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
        <div className="flex-1 flex flex-col justify-center-safe items-center-safe bg-black">
          <h2 className="text-2xl mb-4">No Zone Selected</h2>
          <p>Please select or create a zone</p>
        </div>
      }
      {!zone && (selectedZone !== "") &&
        <div className="flex-1 flex flex-col justify-center-safe items-center-safe bg-black">
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
          <MenuButton className="text-white items-middle h-full px-2 shrink-1 rounded-sm bg-gray-600 cursor-pointer">
            <span>{zone?.name}</span>
            <ChevronDownIcon className="w-6 h-full inline-block ml-2 mb-1" />
          </MenuButton>
          <MenuItems anchor={"bottom"}
            className="border-2 border-gray-400 shadow-2xl absolute rounded z-10 bg-gray-500  text-white">
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
          <div className="factoryActions flex flex-row w-full h-10 bg-black">
            <FactoryControls />
          </div>
          <div className="justify-self-stretch flex flex-row w-full h-[calc(100%-calc(10*var(--spacing)))]">
            <Factory />
          </div>
        </div>

        <Outlet />
      </FactoryProvider >
    } {!selectedFactory &&
      <div className="h-full flex flex-col justify-center-safe items-center-safe bg-black">
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
    border-r-2 border-black
    transition-[width] duration-200 ease-out
    flex flex-col shrink-0">

    <div className="factoryTabs w-full overflow-hidden ">
      <button
        className="h-10 ml-1 block cursor-pointer text-xl text-bold text-center w-full mb-1 border-b-1 border-gray-700" onClick={() => {
          setExpanded(!expanded);
        }}>
        {expanded ? "<" : ">"}
      </button>
      <ul className="ml-1 flex flex-col gap-1 text-center">
        <li className="p-1 bg-black flex flex-row justify-center-safe gap-4 text-white group-data-expanded:text-left
        border-2 border-black border-r-0 border-double rounded-l
        ">
          <button
            onClick={() => {
              setIsCreatingNew(true);
              setExpanded(true);
            }}
            className="h-full cursor-pointer text-gray-400 hover:text-white">
            <PlusIcon className="w-6" />
          </button>
          {expanded &&
            <Link className="text-xs text-gray-400 cursor-pointer"
              to={`./settings/importexport`}
              title="Import Factory"
            >
              <InboxArrowDownIcon className="w-6" />
            </Link>
          }
        </li>
        {factories.map(f => (

          <li key={f.id} data-is-selected={f.id == selectedFactoryId || null}
            className="flex flex-row gap-1 bg-black rounded-l text-gray-500 border-2 
                      border-black border-r-0 border-double hover:text-white
                      data-is-selected:border-amber-500 data-is-selected:text-white
                      data-is-selected:bg-black data-is-selected:cursor-default 
                      overflow-ellipsis whitespace-nowrap items-center-safe
                      p-1 justify-center relative text-left 
          ">
            {f.icon && (
              <img src={f.icon} alt="" className="
                inline-block w-8 h-8  
                " />
            )}
            {(expanded || !f.icon) && (
              <Link className="block flex-1 overflow-hidden w-full"
                onClick={(e) => changeTab(e, f.id)}
                to={`/factories/${f.id}`}>
                {expanded ? f.name : f.name.slice(0, 10)}</Link>
            )}
            {!expanded && f.icon && (
              <Link className="absolute inset-0 pl-2"
                onClick={(e) => changeTab(e, f.id)}
                to={`/factories/${f.id}`}
                title={f.name}
              />
            )}
            {expanded && <>
              <button
                onClick={() => setEditingFactoryId(f.id)}
                className="shrink-1 justify-self-end-safe -mt-1 cursor-pointer hover:text-gray-700 text-white"
                title="Edit Factory"
              >
                <PencilIcon className="w-4 h-full inline-block" />
              </button>
            </>
            }
          </li>)
        )}

      </ul>
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
