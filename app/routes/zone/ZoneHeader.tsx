import { Button, Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ChevronDownIcon, InformationCircleIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
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
        nav('/');
      }
    }
  };

  const handleCancelEdit = () => {
    setIsCreatingNew(false);
    setEditingZoneId(null);
  };

  return (<>
    <h1 className="shrink-1 border-r-2 border-gray-400 pr-8">Factory Planner</h1>
    <h2 className="shrink-1">Zone:</h2>
    <Menu>
      <MenuButton className="text-white items-middle flex-row flex h-full px-2 shrink-1 rounded-sm bg-gray-700 cursor-pointer texture-embossed">
        {zone?.icon && <img src={zone.icon} alt="" className="flex-1 block mr-2" />}
        <span>{zone?.name}</span>
        <ChevronDownIcon className="w-6 flex-1 h-full inline-block ml-2 mb-1" />
      </MenuButton>
      <MenuItems anchor={"bottom start"}
        className="border-2 border-gray-400 shadow-2xl absolute rounded z-10 bg-gray-700  text-white">
        {zones.map(z => (
          <MenuItem key={z.id}>
            <div className="flex flex-row items-center-safe justify-between not-last:border-b-2  border-gray-400">
              <Link className="flex-6 border-0 block px-2 py-1 hover:bg-gray-600 items-center gap-2" to={`/zones/${z.id}`}>
                {z.icon && <img src={z.icon} alt="" className="w-6 " />}
                {z.name}
              </Link>
              <div className="actions p-2 inline-block shrink-1 border-l-2 border-gray-400">
                <Button className="h-full cursor-pointer hover:text-gray-400 block" title="Edit Zone"
                  onClick={() => setEditingZoneId(z.id)}>
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
      onClick={() => setIsCreatingNew(true)} >
      <PencilSquareIcon className="w-5 h-full inline-block" />
    </Button>
    <div className="flex-1" />
    <Link
      to="help?topic=introduction"
      className="shrink-1 cursor-pointer hover:text-white text-gray-400 flex items-center gap-2"
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
