import { getSmartEdge, pathfindingAStarNoDiagonal } from "@joshrp/react-flow-smart-edge";
import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSimpleBezierPath,
  useOnSelectionChange,
  useReactFlow
} from "@xyflow/react";
import { useCallback, useState } from "react";
import useFactory, { useFactoryStore } from "~/context/FactoryContext";
import type { HighlightModes } from "~/context/store";
import { loadData, type ProductId } from "../loadJsonData";
import { productIcon } from "~/uiUtils";
import { isRecipeNode } from "../nodes";

export type ManifoldState = "Under" | "Neutral" | "Over"

export type ButtonEdgeData = {
  isManifold?: boolean
  manifoldState?: ManifoldState | null,
  highlight?: boolean,
};

export type ButtonEdge = Edge<ButtonEdgeData> & {
  sourceHandle: ProductId,
  targetHandle: ProductId
};
const products = loadData().products;

// TODO: Component Testing - This component is complex and needs refactoring for testability:
// 1. Extract product matching logic into a pure function (getAvailableProducts)
// 2. Extract edge path calculation into a testable utility function
// 3. Extract manifold state calculation into a pure function
// 4. Separate edge rendering from edge selection/interaction logic
// 5. Create smaller components:
//    - EdgeLabel component (for displaying product info and manifold state)
//    - EdgePathRenderer component (for rendering the visual edge)
//    - ProductSelectionMenu component (if applicable)
// 6. Add unit tests for extracted pure functions
// 7. Add component tests for sub-components with mocked React Flow context
export default function ButtonEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
  sourceHandleId,
  source,
  target,
}: EdgeProps<ButtonEdge>) {
  const { setEdges } = useReactFlow();

  const manifoldOptions = useFactoryStore(state => state.manifoldOptions);

  const nodes = useFactory().store.getState().nodes.filter(isRecipeNode);
  const highlight = useFactoryStore(state => state.highlight);

  const [hasSelectedHandle, setHasSelectedHandle] = useState(false);
  useOnSelectionChange({
    onChange: useCallback(({ nodes }) => {
      if (nodes.some(n => (n.id === source || n.id === target) && n.selected)) {
        setHasSelectedHandle(true);
      } else {
        setHasSelectedHandle(false);
      }
    }, []),
  })

  let svgPathString, edgeCenterX, edgeCenterY;
  const getSmartEdgeResponse = getSmartEdge({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    nodes,
    options: {
      gridRatio: 20,
      nodePadding: 50,
      generatePath: pathfindingAStarNoDiagonal,
    },
  });

  if (getSmartEdgeResponse instanceof Error) {
    console.error('Error finding Smart Edge Path for', id, getSmartEdgeResponse);

    const bezier = getSimpleBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    svgPathString = bezier[0];
    edgeCenterX = bezier[1];
    edgeCenterY = bezier[2];
  } else {
    svgPathString = getSmartEdgeResponse.svgPathString;
    edgeCenterX = getSmartEdgeResponse.edgeCenterX;
    edgeCenterY = getSmartEdgeResponse.edgeCenterY;
  }

  const onEdgeClick = () => {
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  };
  const man = manifoldOptions.find(man => {
    return new Set(Object.keys(man.edges)).has(id)

  });

  const productColor = products.get(sourceHandleId as ProductId)?.color || "#333";
  const product = products.get(sourceHandleId as ProductId);

  const classes = ["baseEdge"];

  const highlightEdge = shouldHighlightProduct(highlight, sourceHandleId as ProductId);
  const shouldMute = shouldMuteProduct(highlight, sourceHandleId as ProductId);


  if (data?.highlight || hasSelectedHandle || highlightEdge)
    classes.push("highlightFlow");

  if (shouldMute)
    classes.push("mutedFlow");

  if (man?.free === true)
    classes.push("edgeAlert", "highlightFlow");

  style.stroke = productColor;
  const buttonStyle: Record<string, string> = {
    borderColor: productColor,
    border: 'none'
  };
  return (
    <>
      <BaseEdge path={svgPathString} markerEnd={markerEnd} style={style} className={classes.join(' ')} />
      <EdgeLabelRenderer>
        {product && (<div
          style={{
            display: selected ? "flex" : "none",
            position: "absolute",
            transform: `translate(-50%, -50%) translate(calc(${edgeCenterX}px - 60px),${edgeCenterY}px)`,
            fontSize: 16,
            zIndex: 1500,
            // everything inside EdgeLabelRenderer has no pointer events by default
            // if you have an interactive element, set pointer-events: all
            pointerEvents: "all",
            alignItems: "center",
            gap: "4px",
            width: "50px",
            padding: "4px",
            borderRadius: "4px",
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            justifyContent: "center",
          }}
          className="nodrag nopan"
        >
          <img
            src={productIcon(product.icon)}
            alt={product.name}
            title={product.name}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
        )}
        <div
          style={{
            display: selected ? "flex" : "none",
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${edgeCenterX}px,${edgeCenterY}px)`,
            fontSize: 16,
            zIndex: 1500,
            // everything inside EdgeLabelRenderer has no pointer events by default
            // if you have an interactive element, set pointer-events: all
            pointerEvents: "all",
            alignItems: "center",
            gap: "4px",
          }}
          className="nodrag nopan edgeDeleteButton"
        >
          <button style={buttonStyle} title="Delete Line" onClick={onEdgeClick}>
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const shouldHighlightProduct = (highlight: HighlightModes | undefined, productId: ProductId): boolean => {
  if (!highlight) return false;
  if (highlight.mode !== "product") return false;
  if (highlight.productId !== productId) {
    return false;
  }
  if (highlight.options.edges !== true) {
    return false;
  }
  return true;
}

const shouldMuteProduct = (highlight: HighlightModes | undefined, productId: ProductId): boolean => {
  if (!highlight) return false;
  if (highlight.mode !== "product") return false;
  if (highlight.productId !== productId) {
    return true;
  }
  return false;
}
