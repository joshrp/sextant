import { useCallback, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { SelectorDialog } from '~/components/Dialog';

interface AnnotationEditDialogProps {
  isOpen: boolean;
  initialText: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}

/**
 * Modal dialog for editing annotation node text.
 * Left side: textarea for raw markdown. Right side: live rendered preview.
 */
export default function AnnotationEditDialog({
  isOpen,
  initialText,
  onSave,
  onCancel,
}: AnnotationEditDialogProps) {
  const [text, setText] = useState(initialText);

  // Reset text when dialog opens with new initial text
  useEffect(() => {
    if (isOpen) {
      setText(initialText);
    }
  }, [isOpen, initialText]);

  const handleSave = useCallback(() => {
    onSave(text);
  }, [onSave, text]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSave, onCancel],
  );

  return (
    <SelectorDialog
      isOpen={isOpen}
      setIsOpen={(open) => !open && onCancel()}
      title="Edit Note"
      widthClassName="w-[700px]"
      heightClassName="max-h-[80vh]"
    >
      <div className="flex gap-4 p-2 min-h-75" onKeyDown={handleKeyDown}>
        {/* Editor */}
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-xs text-disabled font-medium">Markdown</label>
          <textarea
            className="flex-1 w-full bg-gray-900 text-text border border-border rounded p-2 text-sm font-mono resize-none focus:outline-none focus:border-blueprint"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your note here... Markdown is supported."
            autoFocus
          />
        </div>

        {/* Preview */}
        <div className="flex-1 flex flex-col gap-1 overflow-auto">
          <label className="text-xs text-disabled font-medium">Preview</label>
          <div className="flex-1 bg-gray-900/50 border border-border rounded p-2 text-sm text-text overflow-auto
            prose prose-sm prose-invert max-w-none
            [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-1 [&_h1]:mt-0
            [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-1 [&_h2]:mt-0
            [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mb-1 [&_h3]:mt-0
            [&_p]:mb-1 [&_p]:last:mb-0 [&_p]:mt-0
            [&_ul]:mb-1 [&_ul]:pl-4 [&_ol]:mb-1 [&_ol]:pl-4
            [&_li]:mb-0
            [&_code]:text-xs [&_code]:bg-gray-800 [&_code]:px-1 [&_code]:rounded
            [&_a]:text-blueprint [&_a]:underline
            [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-2 [&_blockquote]:text-disabled [&_blockquote]:italic
          ">
            {text ? (
              <Markdown>{text}</Markdown>
            ) : (
              <span className="text-disabled italic">Nothing to preview</span>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center px-2 pt-3 border-t border-border mt-2">
        <span className="text-xs text-disabled">Ctrl+Enter to save</span>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded cursor-pointer text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-accent hover:bg-accent/80 text-white rounded cursor-pointer text-sm"
          >
            Save
          </button>
        </div>
      </div>
    </SelectorDialog>
  );
}
