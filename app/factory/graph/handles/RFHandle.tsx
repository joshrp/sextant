import { Handle, Position } from '@xyflow/react';
import { productIcon } from '~/uiUtils';
import type { Product } from '../loadJsonData';

const handleStyle: React.CSSProperties = { 
  width: "auto", 
  height: "auto", 
  position: "initial", 
  transform: "initial", 
  border: 'none', 
  backgroundColor: 'transparent' 
};

export interface RFHandleProps {
  /** The product to display in the handle */
  product: Product;
  /** Whether this product is optional */
  optional?: boolean;
  /** The position of the handle (left or right) */
  position: Position;
  /** Whether this is an input handle (true) or output handle (false) */
  isInput: boolean;
  /** The color to use for the handle connector visual */
  productColor: string;
  /** Whether the node is in left-to-right orientation */
  ltr: boolean;
}

/**
 * React Flow Handle component for product connections.
 * Renders the handle with product icon and connection visual indicator.
 */
export default function RFHandle({
  product,
  optional = false,
  position,
  isInput,
  productColor,
  ltr,
}: RFHandleProps) {
  const handleType = isInput ? "target" : "source";
  const isLeft = position === Position.Left;
  
  // Calculate the visual connector orientation
  const connectorClass = isInput 
    ? (ltr ? "" : "scale-x-[-1]")
    : (ltr ? "scale-x-[-1]" : "");
  
  return (
    <Handle 
      type={handleType}
      position={position}
      id={product.id}
      style={handleStyle}
      className="handle py-2 text-center"
    >
      <img 
        data-optional={optional ? true : null} 
        src={productIcon(product.icon)} 
        alt={product.name}
        className="drop-shadow-md/30 pointer-events-none block max-w-8 
          data-optional:p-0.5 data-optional:box-content data-optional:border-1 border-dashed border-gray-400 border-0"
      />
      <div
        style={{
          backgroundColor: productColor,
          borderColor: productColor,
        }}
        className={`clipped hidden pointer-events-none w-6 top-0 h-[101%] absolute border-1 ${isLeft ? "-left-5" : "-right-5"} ${connectorClass}`}
      ></div>
    </Handle>
  );
}
