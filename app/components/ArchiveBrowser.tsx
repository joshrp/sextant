import { ArchiveBoxIcon, ArrowPathIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { SelectorDialog } from "./Dialog";
import useProductionZone from "~/context/ZoneContext";
import type { ArchivedFactoryMetadata } from "~/context/factoryArchive";

interface ArchiveBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored?: (factoryId: string) => void;
}

export default function ArchiveBrowser({ isOpen, onClose, onRestored }: ArchiveBrowserProps) {
  const zone = useProductionZone();
  const [archives, setArchives] = useState<ArchivedFactoryMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadArchives();
    }
  }, [isOpen]);

  const loadArchives = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await zone.listArchivedFactories();
      setArchives(list);
    } catch (e) {
      setError("Failed to load archives: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (archive: ArchivedFactoryMetadata) => {
    setRestoring(archive.id);
    setError(null);
    try {
      const newFactoryId = await zone.restoreFactory(archive.id);
      onRestored?.(newFactoryId);
      onClose();
    } catch (e) {
      setError("Failed to restore factory from archive: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRestoring(null);
    }
  };

  const handleDelete = async (archive: ArchivedFactoryMetadata) => {
    if (!confirm(`Permanently delete "${archive.name}" from the archive? This cannot be undone.`)) {
      return;
    }
    try {
      await zone.deleteArchivedFactory(archive.id);
      await loadArchives();
    } catch (e) {
      setError("Failed to delete archived factory: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <SelectorDialog
      isOpen={isOpen}
      setIsOpen={(open) => !open && onClose()}
      title="Archived Factories"
      widthClassName="w-[700px]"
      heightClassName="max-h-[80vh]"
    >
      <div className="flex flex-col gap-4 p-4">
        {error && (
          <div className="p-3 bg-red-900/50 text-red-200 rounded border border-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-8 text-gray-400">
            <ArrowPathIcon className="w-8 h-8 mx-auto animate-spin" />
            <p className="mt-2">Loading archives...</p>
          </div>
        )}

        {!loading && archives.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <ArchiveBoxIcon className="w-12 h-12 mx-auto opacity-50" />
            <p className="mt-2">No archived factories found</p>
            <p className="text-sm">Factories you archive will appear here</p>
          </div>
        )}

        {!loading && archives.length > 0 && (
          <div className="flex flex-col gap-2">
            {archives.map((archive) => (
              <div
                key={archive.id}
                className="flex items-center gap-3 p-3 bg-gray-800 rounded border border-gray-700 hover:border-gray-600"
              >
                {/* Icon */}
                {archive.icon ? (
                  <img src={archive.icon} alt="" className="w-10 h-10" />
                ) : (
                  <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center">
                    <ArchiveBoxIcon className="w-6 h-6 text-gray-500" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{archive.name}</div>
                  <div className="text-sm text-gray-400">
                    {archive.nodeCount} nodes · {archive.edgeCount} edges · {archive.goalCount} goals
                  </div>
                  <div className="text-xs text-gray-500">
                    Archived {formatDate(archive.archivedAt)}
                  </div>
                  {archive.description && (
                    <div className="text-xs text-gray-400 mt-1 truncate">{archive.description}</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRestore(archive)}
                    disabled={restoring !== null}
                    className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded text-sm 
                              disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {restoring === archive.id ? (
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      "Restore"
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(archive)}
                    disabled={restoring !== null}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/50 rounded
                              disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    title="Delete permanently"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </SelectorDialog>
  );
}
