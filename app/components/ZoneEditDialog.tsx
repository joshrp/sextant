import { TrashIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { SelectorDialog } from "./Dialog";
import IconSelector, { type IconInfo } from "./IconSelector";
import ConfirmDialog from "./ConfirmDialog";
import { getAllIcons } from "~/uiUtils";
import { loadData } from "~/factory/graph/loadJsonData";

const { products, machines } = loadData();

type ZoneEditDialogProps = {
  isOpen: boolean;
  zoneId?: string;
  initialName?: string;
  initialIcon?: string;
  initialDescription?: string;
  existingZoneNames: string[];
  onSave: (data: { name: string; icon?: string; description?: string }) => void;
  onCancel: () => void;
  onDelete?: () => void;
  title?: string;
  showDeleteButton?: boolean;
};

export default function ZoneEditDialog({
  isOpen,
  initialName = "",
  initialIcon = "",
  initialDescription = "",
  existingZoneNames,
  onSave,
  onCancel,
  onDelete,
  title = "Edit Zone",
  showDeleteButton = false,
}: ZoneEditDialogProps) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState<string | undefined>(initialIcon || undefined);
  const [description, setDescription] = useState(initialDescription);
  const [showIconSelector, setShowIconSelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [nameManuallyEdited, setNameManuallyEdited] = useState(!!initialName);
  
  const allIcons = getAllIcons(products, machines);
  const [nameError, setNameError] = useState<string | null>(null);

  const handleSave = () => {
    if (name.trim() === "") {
      setNameError("Zone name cannot be empty");
      return;
    }
    setNameError(null);
    onSave({ name: name.trim(), icon, description: description.trim() });
  };

  const handleIconSelect = (iconInfo: IconInfo) => {
    setIcon(iconInfo.path);
    setShowIconSelector(false);
    
    // Auto-populate name from icon if not manually edited
    if (!nameManuallyEdited) {
      setName(iconInfo.name);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setNameManuallyEdited(true);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    onDelete?.();
  };

  // Check for name collision - memoize the trimmed name
  const trimmedName = name.trim();
  const hasNameCollision = trimmedName !== "" && trimmedName !== initialName && existingZoneNames.includes(trimmedName);

  return (
    <>
      <SelectorDialog
        isOpen={isOpen && !showIconSelector && !showDeleteConfirm}
        setIsOpen={(open) => !open && onCancel()}
        title={title}
        widthClassName="w-[600px]"
        heightClassName="max-h-[80vh]"
      >
        <div className="flex flex-col gap-4 p-4">
          {/* Icon Selector - Now First */}
          <div>
            <label className="block text-sm font-medium mb-2">Icon</label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowIconSelector(true)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded border border-gray-600 cursor-pointer"
              >
                {icon ? "Change Icon" : "Select Icon"}
              </button>
              {icon && (
                <div className="flex items-center gap-2">
                  <img src={icon} alt="Selected icon" className="w-12 h-12" />
                  <button
                    onClick={() => setIcon(undefined)}
                    className="text-red-400 hover:text-red-300 text-sm cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Name Input - Now Second, no asterisk */}
          <div>
            <label className="block text-sm font-medium mb-2">Zone Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                handleNameChange(e);
                if (nameError) setNameError(null);
              }}
              className={`w-full px-3 py-2 bg-gray-700 text-white rounded border focus:outline-none ${
                hasNameCollision || nameError ? 'border-red-500' : 'border-gray-600 focus:border-blue-500'
              }`}
              placeholder="Enter zone name"
            />
            {hasNameCollision && (
              <p className="text-red-400 text-sm mt-1">
                A zone with this name already exists
              </p>
            )}
            {nameError && !hasNameCollision && (
              <p className="text-red-400 text-sm mt-1">
                {nameError}
              </p>
            )}
          </div>

          {/* Description Input */}
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="Enter optional description"
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t border-gray-700">
            {/* Delete button on the left */}
            <div>
              {showDeleteButton && onDelete && (
                <button
                  onClick={handleDeleteClick}
                  className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded cursor-pointer flex items-center gap-2"
                  title="Delete this zone permanently"
                >
                  <TrashIcon className="w-5 h-5" />
                  Delete Zone
                </button>
              )}
            </div>
            {/* Cancel and Save on the right */}
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={hasNameCollision}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </SelectorDialog>

      {showIconSelector && (
        <IconSelector
          isOpen={showIconSelector}
          setIsOpen={setShowIconSelector}
          icons={allIcons}
          onSelect={handleIconSelect}
          selectedIcon={icon}
        />
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete Zone"
        confirmText="Delete Zone"
        cancelText="Cancel"
        isDestructive={true}
      >
        <p>Permanently delete zone &quot;{initialName}&quot;?</p>
        <p>This will remove all data for the zone, including factories.</p>
        <p>This action cannot be undone.</p>
      </ConfirmDialog>
    </>
  );
}
