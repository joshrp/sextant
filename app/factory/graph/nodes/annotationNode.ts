import type { Node } from "@xyflow/react";

/**
 * Data for annotation nodes — free-form markdown notes on the canvas.
 * These are purely visual and do not participate in the solver or graph model.
 */
export type AnnotationNodeData = {
  text: string;
  /** When true, the edit dialog opens automatically on mount (then cleared). */
  autoEdit?: boolean;
};

/**
 * React Flow node type for annotations.
 * The second generic param "annotation-node" is the React Flow node type key.
 */
export type AnnotationNodeType = Node<AnnotationNodeData, "annotation-node">;
