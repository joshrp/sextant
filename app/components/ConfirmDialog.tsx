import { SelectorDialog } from "./Dialog";

interface ConfirmDialogProps extends React.PropsWithChildren {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  confirmText?: string;
  cancelText?: string;
  confirmClassName?: string;
  isDestructive?: boolean;
}

/**
 * A reusable confirmation dialog component that replaces browser's confirm()
 */
export default function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  children,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmClassName,
  isDestructive = false,
}: ConfirmDialogProps) {
  const defaultConfirmClass = isDestructive
    ? "bg-red-600 hover:bg-red-500"
    : "bg-amber-700 hover:bg-amber-600";

  return (
    <SelectorDialog
      isOpen={isOpen}
      setIsOpen={(open) => !open && onCancel()}
      title={title}
      widthClassName="w-[450px]"
      heightClassName="max-h-[300px]"
    >
      <div className="flex flex-col gap-6 p-4">
        <div className="text-gray-200">{children}</div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded cursor-pointer ${confirmClassName || defaultConfirmClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </SelectorDialog>
  );
}
