import { Position } from '@xyflow/react';
import type { HighlightModes } from '../../store';
import type { ProductId } from '../loadJsonData';
import RFHandle from './RFHandle';
import type { RFHandleProps } from './RFHandle';
import { Switch } from '@headlessui/react';
import { formatNumber } from '~/uiUtils';

export interface ProductHandlePropsBase {
  /** The product data for this handle */
  product: RFHandleProps['product'];
  /** The quantity of this product */
  quantity: number;
  /** Hide the quantity display */
  hideQuantity?: boolean;
  /** Whether this product is optional */
  optional?: boolean;
  /** The position of the handle (left or right) */
  position: Position;
  /** Whether this is an input handle (true) or output handle (false) */
  isInput: boolean;
  /** Whether this handle is connected to an edge */
  isConnected: boolean;
  /** The color to use for the handle background */
  productColor: string;
  /** Whether the node is in left-to-right orientation */
  ltr: boolean;
  /** The run count from the solution */
  displayRunCount: number;
  /** Highlight settings */
  highlight?: HighlightModes;
  /** Optional node ID for edge highlighting */
  nodeId?: string;
}
export interface ProductHandleWithoutSwitchProps extends ProductHandlePropsBase {
  /** Function to toggle the switch */
  hasSwitch: false;
}
export interface ProductHandleWithSwitchProps extends ProductHandlePropsBase {
  hasSwitch: true;
  switchToggle: (value: boolean) => void;
  switchTitle: string;
  switchState: boolean;
}

export type ProductHandleProps = ProductHandleWithoutSwitchProps | ProductHandleWithSwitchProps;

/**
 * Individual product handle component with quantity display.
 * Wraps RFHandle and adds the quantity text and styling.
 */
export default function ProductHandle(props: ProductHandleProps) {
  const {
    product,
    quantity,
    optional = false,
    position,
    isInput,
    isConnected,
    productColor,
    ltr,
    highlight,
    nodeId,
  } = props;
  const isLeft = position === Position.Left;
  const inOrOut = <T extends string>(input: T, output: T) => isInput ? input : output;

  const handle = (
    <RFHandle
      product={product}
      optional={optional}
      position={position}
      isInput={isInput}
      productColor={productColor}
      ltr={ltr}
    />
  );

  let switchElement = null;
  if (props.hasSwitch) {
    switchElement =
      <div className="flex-1 h-full flex items-center justify-center">
        <Switch
          onChange={props.switchToggle}
          checked={props.switchState}
          title={props.switchTitle}
          className={`${props.switchState ? 'bg-blue-600' : 'bg-gray-200'
            } relative inset-shadow-sm/30 m-1 inline-flex h-6 w-11 items-center cursor-pointer rounded-full`}
        >
          <span className="sr-only">{props.switchTitle}</span>
          <span
            className={`${props.switchState ? 'translate-x-6' : 'translate-x-1'
              } inline-block h-4 w-4 transform rounded-full bg-white transition`}
          />
        </Switch>
      </div>
  }
  return (
    <div
      style={{ backgroundColor: productColor }}
      className={`recipe-${inOrOut("input", "output")} flex flex-row recipe-handle relative 
                text-nowrap  ${isLeft ? "pl-2" : "pr-2"} mt-4 first:mt-0 items-center-safe
                align-middle
                `}
      data-connected={isConnected}
      data-highlight={shouldHighlightProduct(highlight, product.id, isInput, isConnected, nodeId) ? true : null}
      data-muted={shouldMuteProduct(highlight, product.id, nodeId) ? true : null}
    >
      {isLeft ? handle : switchElement}
      <div className="flex-1 min-w-4 p-2 text-shadow-md/50">
        {props.hideQuantity ? '' : formatNumber(quantity, product.unit)}
      </div>
      {isLeft ? switchElement : handle}
    </div>
  );
}

const shouldHighlightProduct = (highlight: HighlightModes | undefined, productId: ProductId, input: boolean, connected: boolean, nodeId?: string): boolean => {
  if (!highlight) return false;

  if (highlight.mode === "edge") {
    // For edge mode, highlight the handle if it matches the edge's source or target
    if (nodeId === highlight.sourceNodeId && productId === highlight.sourceHandle) {
      return true;
    }
    if (nodeId === highlight.targetNodeId && productId === highlight.targetHandle) {
      return true;
    }
    return false;
  }

  if (highlight.mode !== "product") return false;
  if (highlight.productId !== productId) {
    return false;
  }
  let inputType = false;
  inputType ||= (highlight.options.inputs && input);
  inputType ||= (highlight.options.outputs && !input);
  let connectedType = false;
  connectedType ||= (highlight.options.connected && connected);
  connectedType ||= (highlight.options.unconnected && !connected);
  return inputType && connectedType;
}

const shouldMuteProduct = (highlight: HighlightModes | undefined, productId: ProductId, nodeId?: string): boolean => {
  if (!highlight) return false;

  if (highlight.mode === "edge") {
    // For edge mode, mute handles that are not part of the selected edge
    const isSourceHandle = nodeId === highlight.sourceNodeId && productId === highlight.sourceHandle;
    const isTargetHandle = nodeId === highlight.targetNodeId && productId === highlight.targetHandle;
    return !(isSourceHandle || isTargetHandle);
  }

  if (highlight.mode !== "product") return false;
  if (highlight.productId === productId) {
    return false;
  }

  return true;
}
