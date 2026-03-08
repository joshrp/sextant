import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import useProductionZone, { useProductionZoneStore } from "~/context/ZoneContext";
import { useFactoryStore } from "~/context/FactoryContext";
import ConfirmDialog from "./ConfirmDialog";

interface FactoryArchiveHandlerProps {
  factoryId: string;
  onComplete: () => void;
}

/**
 * Component inside FactoryProvider that handles archiving the current factory.
 * Shows a confirmation dialog, then archives and removes the factory.
 */
export default function FactoryArchiveHandler({ factoryId, onComplete }: FactoryArchiveHandlerProps) {
  const nav = useNavigate();
  const zone = useProductionZone();
  const factories = useProductionZoneStore(state => state.factories);

  // Get factory data using individual selectors to avoid object creation
  const factoryName = useFactoryStore(state => state.name);
  const factoryNodes = useFactoryStore(state => state.nodes);
  const factoryEdges = useFactoryStore(state => state.edges);
  const factoryGoals = useFactoryStore(state => state.goals);

  // Capture factory data at mount time - we want to archive the data as it was when
  // the user clicked "Archive", not as it might change while the dialog is open.
  // useRef only uses the initial value once, so this is intentionally stable.
  const factoryDataRef = useRef({
    name: factoryName,
    nodes: factoryNodes,
    edges: factoryEdges,
    goals: factoryGoals,
  });

  const [showConfirm, setShowConfirm] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setShowConfirm(false);
    setArchiving(true);
    setError(null);
    try {
      // Archive the factory using the captured data
      await zone.archiveFactory(factoryId, factoryDataRef.current);

      // Remove from active factories
      await zone.deleteFactory(factoryId);

      // Navigate to another factory or create a new one
      const remainingFactories = factories.filter(f => f.id !== factoryId);
      if (remainingFactories.length > 0) {
        nav(`/zones/${zone.id}/${remainingFactories[0].id}`);
      } else {
        nav(`/zones/${zone.id}`);
      }
      onComplete();
    } catch (e) {
      setError("Failed to archive factory: " + (e instanceof Error ? e.message : String(e)));
      setArchiving(false);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
    onComplete();
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 text-white max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={onComplete}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (archiving) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 text-white">
          Archiving factory...
        </div>
      </div>
    );
  }

  return (
    <ConfirmDialog
      isOpen={showConfirm}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      title="Archive Factory"
      confirmText="Archive"
      cancelText="Cancel"
    >
      <p>Archive &quot;{factoryDataRef.current.name}&quot;?</p>
      <p>This will remove it from your active factories, but you can restore it later from the archive.</p>
    </ConfirmDialog>
  );
}
