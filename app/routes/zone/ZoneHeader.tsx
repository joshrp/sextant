import { Button, Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ChevronDownIcon, InformationCircleIcon, PlusIcon } from "@heroicons/react/24/outline";
import { PencilIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import ZoneEditDialog from "~/components/ZoneEditDialog";
import { usePlannerStore } from "~/context/PlannerContext";

export default function ZoneHeader({ selectedZone }: { selectedZone?: string }) {
  const nav = useNavigate();
  const zones = usePlannerStore(state => state.zones);
  const zone = zones.find(z => z.id === selectedZone);
  const updateZone = usePlannerStore(state => state.updateZone);
  const deleteZone = usePlannerStore(state => state.deleteZone);
  const newZoneAction = usePlannerStore(state => state.newZone);

  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const editingZone = editingZoneId ? zones.find(z => z.id === editingZoneId) : null;
  const existingZoneNames = zones.filter(z => z.id !== editingZoneId).map(z => z.name);

  const handleSaveZone = (data: { name: string; icon?: string; description?: string }) => {
    if (isCreatingNew) {
      const newId = newZoneAction(data.name, data.icon, data.description);
      setIsCreatingNew(false);
      nav(`/zones/${newId}`);
    } else if (editingZoneId) {
      updateZone(editingZoneId, data);
      setEditingZoneId(null);
    }
  };

  const handleDeleteZone = () => {
    if (!editingZoneId) return;

    // Delete the zone
    deleteZone(editingZoneId);
    setEditingZoneId(null);

    // Navigate to another zone if the deleted zone was selected
    if (editingZoneId === selectedZone) {
      const remainingZones = zones.filter(z => z.id !== editingZoneId);
      if (remainingZones.length > 0) {
        nav(`/zones/${remainingZones[0].id}`);
      } else {
        nav(`/`);
      }
    }
  };

  const handleCancelEdit = () => {
    setIsCreatingNew(false);
    setEditingZoneId(null);
  };

  return (<>
    <h1 className="shrink-1 border-r-2 border-gray-400 pr-8">
      <img src={`${import.meta.env.BASE_URL}sextant-white.svg`} alt="Sextant Logo" className="w-10 inline-block mr-2" />
      Sextant - CoI Planner
    </h1>
    <h2 className="shrink-1 ml-6">Zone:</h2>
    <Menu>
      <MenuButton className="flex-row flex justify-between
                              px-2 py-1 min-w-30 items-middle h-full
                            text-white rounded-sm bg-gray-700 cursor-pointer 
        ">{zone?.icon && <img src={zone.icon} alt="" className="flex-1 block mr-2 h-full" />}
        <span>{zone?.name}</span>
        <ChevronDownIcon className="w-6 shrink inline-block ml-2" />
      </MenuButton>
      <MenuItems anchor={"bottom start"}
        className="border border-gray-400 shadow-2xl absolute rounded z-10 bg-gray-700 text-white">
        {zones.map(z => (
          <MenuItem key={z.id}>
            <div className="flex flex-row items-center items-center-safe h-12 justify-between not-last:border-b-2  border-gray-400">
              <Link className="flex flex-6 align-middle border-0 p-2 h-full hover:bg-gray-600 items-center gap-2" to={`/zones/${z.id}`}>
                {z.icon && <img src={z.icon} alt="" className="h-full inline mr-1" />}{z.name}
              </Link>
              <div className="actions p-2 inline-block shrink border-l-2 border-gray-400">
                <Button className="h-full cursor-pointer hover:text-gray-400 block" title="Edit Zone"
                  onClick={() => setEditingZoneId(z.id)}>
                  <PencilIcon className="w-4 h-full" />
                </Button>
              </div>
            </div>
          </MenuItem>
        ))}
        {zones.length <= 1 && (
          <div className="px-3 py-2 text-xs text-gray-400 italic border-t border-gray-500">
            Zones are isolated production areas
          </div>
        )}
      </MenuItems>
    </Menu>
    <Button className="shrink -mt-1 cursor-pointer hover:text-white text-gray-500 "
      title="Create New Zone"
      onClick={() => setIsCreatingNew(true)} >
      <PlusIcon className="w-5 h-full inline-block" />
    </Button>
    <div className="flex-1" />
    <a
      href="https://github.com/joshrp/sextant"
      target="_blank"
      rel="noopener noreferrer"
      className="shrink cursor-pointer hover:text-white text-gray-400 flex items-center"
      title="GitHub Repository"
    >
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
      </svg>
    </a>
    <Link
      to="help?topic=introduction"
      className="shrink cursor-pointer hover:text-white text-gray-400 flex items-center gap-2"
      title="Help"
    >
      <InformationCircleIcon className="w-6 h-6" />
      <span>Help</span>
    </Link>

    {(isCreatingNew || editingZoneId) && (
      <ZoneEditDialog
        isOpen={true}
        zoneId={editingZoneId || undefined}
        initialName={editingZone?.name || ""}
        initialIcon={editingZone?.icon}
        initialDescription={editingZone?.description}
        existingZoneNames={existingZoneNames}
        onSave={handleSaveZone}
        onCancel={handleCancelEdit}
        onDelete={handleDeleteZone}
        title={isCreatingNew ? "Create Zone" : "Edit Zone"}
        showDeleteButton={!isCreatingNew && zones.length > 1}
      />
    )}
  </>);
}
