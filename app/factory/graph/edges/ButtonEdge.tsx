import { getSmartEdge, pathfindingAStarNoDiagonal } from "@joshrp/react-flow-smart-edge";
import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
  useOnSelectionChange,
  useReactFlow
} from "@xyflow/react";
import { memo, useCallback, useMemo, useState } from "react";
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

function ButtonEdge({
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

  const man = useFactoryStore(state => state.manifoldOptions.find(m => id in m.edges));
  const highlight = useFactoryStore(state => state.highlight);
  const factoryStore = useFactory().store;

  const [hasSelectedHandle, setHasSelectedHandle] = useState(false);
  useOnSelectionChange({
    onChange: useCallback(({ nodes }) => {
      if (nodes.some(n => (n.id === source || n.id === target) && n.selected)) {
        setHasSelectedHandle(true);
      } else {
        setHasSelectedHandle(false);
      }
    }, [source, target]),
  })

  const [svgPathString, edgeCenterX, edgeCenterY] = useMemo(() => {
    const nodes = factoryStore.getState().nodes.filter(isRecipeNode);
    const getSmartEdgeResponse = getSmartEdge({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      nodes,
      options: {
        gridRatio: 10,
        nodePadding: 40,
        generatePath: pathfindingAStarNoDiagonal,
      },
    });

    if (getSmartEdgeResponse instanceof Error) {
      const bezier = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });
      return [bezier[0], bezier[1], bezier[2]];
    } else {
      return [getSmartEdgeResponse.svgPathString, getSmartEdgeResponse.edgeCenterX, getSmartEdgeResponse.edgeCenterY];
    }
  }, [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, factoryStore]);

  const onEdgeClick = useCallback(() => {
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  }, [id, setEdges]);

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

  const edgeStyle = { ...style, stroke: productColor };
  const buttonStyle: Record<string, string> = {
    borderColor: productColor,
    border: 'none'
  };
  return (
    <>
      <BaseEdge path={svgPathString} markerEnd={markerEnd} style={edgeStyle} className={classes.join(' ')} />
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

export default memo(ButtonEdge);

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
