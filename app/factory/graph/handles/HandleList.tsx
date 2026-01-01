import { Position } from '@xyflow/react';
import type { ReactNode } from 'react';

export interface HandleListProps {
  /** The position of handles (left or right) */
  pos: Position;
  /** Whether these are input handles (true) or output handles (false) */
  inputs: boolean;
  /** Child ProductHandle components to render */
  children?: ReactNode;
}

/**
 * Container component that arranges product handles.
 * Handles layout and positioning of input/output handles based on orientation.
 * The parent component should iterate over products and pass ProductHandle components as children.
 */
export default function HandleList({ 
  pos, 
  inputs, 
  children 
}: HandleListProps) {
  const ltr = <T extends string>(left: T, right: T) => pos === Position.Left ? left : right;
  const inOrOut = <T extends string>(input: T, output: T) => inputs ? input : output;
  
  return (
    <div className={
      `recipe-${inOrOut("inputs", "outputs")} 
        recipe-list
        flex-2 relative 
        ${ltr("items-start -left-2", "justify-end-safe -right-2")}`
    }>
      {children}
    </div>
  );
}
