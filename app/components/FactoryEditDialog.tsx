import { useState } from "react";
import { SelectorDialog } from "./Dialog";
import IconSelector, { type IconInfo } from "./IconSelector";
import { getAllIcons } from "~/uiUtils";
import { loadData } from "~/factory/graph/loadJsonData";

const { products, machines } = loadData();

type FactoryEditDialogProps = {
  isOpen: boolean;
  factoryId?: string;
  initialName?: string;
  initialIcon?: string;
  initialDescription?: string;
  existingFactoryNames: string[];
  onSave: (data: { name: string; icon?: string; description?: string }) => void;
  onCancel: () => void;
  title?: string;
};

export default function FactoryEditDialog({
  isOpen,
  initialName = "",
  initialIcon = "",
  initialDescription = "",
  existingFactoryNames,
  onSave,
  onCancel,
  title = "Edit Factory"
}: FactoryEditDialogProps) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState<string | undefined>(initialIcon || undefined);
  const [description, setDescription] = useState(initialDescription);
  const [showIconSelector, setShowIconSelector] = useState(false);
  const [nameManuallyEdited, setNameManuallyEdited] = useState(!!initialName);
  
  const allIcons = getAllIcons(products, machines);

  const handleSave = () => {
    if (name.trim() === "") {
      alert("Factory name cannot be empty");
      return;
    }
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

  // Check for name collision - memoize the trimmed name
  const trimmedName = name.trim();
  const hasNameCollision = trimmedName !== "" && trimmedName !== initialName && existingFactoryNames.includes(trimmedName);

  return (
    <>
      <SelectorDialog
        isOpen={isOpen && !showIconSelector}
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
            <label className="block text-sm font-medium mb-2">Factory Name</label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              className={`w-full px-3 py-2 bg-gray-700 text-white rounded border focus:outline-none ${
                hasNameCollision ? 'border-red-500' : 'border-gray-600 focus:border-blue-500'
              }`}
              placeholder="Enter factory name"
            />
            {hasNameCollision && (
              <p className="text-red-400 text-sm mt-1">
                A factory with this name already exists in this zone
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
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
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
    </>
  );
}
