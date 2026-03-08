import { type NodeProps } from '@xyflow/react';
import { memo, useCallback, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useFactoryStore } from '../../../context/FactoryContext';
import type { AnnotationNodeType } from './annotationNode';
import AnnotationEditDialog from '../AnnotationEditDialog';

/**
 * React Flow node component for annotation (free-form note) nodes.
 * Renders markdown content, no handles, visually distinct from recipe nodes.
 * Double-click opens the edit dialog.
 */
function AnnotationNode({ id, data, selected }: NodeProps<AnnotationNodeType>) {
  const [editing, setEditing] = useState(false);
  const setNodeData = useFactoryStore(state => state.setNodeData);
  const removeNode = useFactoryStore(state => state.removeNode);

  // Auto-open edit dialog when node is created with autoEdit flag
  useEffect(() => {
    if (data.autoEdit) {
      setEditing(true);
      // Clear the flag so it doesn't re-trigger
      setNodeData(id, { autoEdit: false });
    }
  }, [data.autoEdit, id, setNodeData]);

  const handleDoubleClick = useCallback(() => {
    setEditing(true);
  }, []);

  const handleSave = useCallback((text: string) => {
    setNodeData(id, { text });
    setEditing(false);
  }, [id, setNodeData]);

  const handleCancel = useCallback(() => {
    setEditing(false);
  }, []);

  return (
    <>
      <div
        onDoubleClick={handleDoubleClick}
        className={[
          'annotation-node',
          'rounded-lg px-4 py-3 min-w-[120px] max-w-[400px]',
          'bg-gray-900/80 border-2',
          selected ? 'border-blueprint' : 'border-border',
          'text-text text-sm leading-relaxed',
          'cursor-grab',
          'relative',
        ].join(' ')}
      >
        <button
          className="absolute top-1 right-1 cursor-pointer text-red-500/50 hover:text-white/80 hover:bg-red-500/50 p-1 rounded z-10"
          onClick={() => removeNode(id)}
          title="Delete annotation"
        >
          <TrashIcon className='w-5 h-5' />
        </button>
        {data.text ? (
          <div className="annotation-content">
            <Markdown>{data.text}</Markdown>
          </div>
        ) : (
          <div className="p-4 italic text-2xl">
            Double-click to edit
          </div>
        )}
      </div>
      <AnnotationEditDialog
        isOpen={editing}
        initialText={data.text}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </>
  );
}

export default memo(AnnotationNode);
