import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  useReactFlow
} from "@xyflow/react";
import type { ProductId } from "../loadJsonData";
import useFactory from "~/factory/FactoryContext";
import { useStore } from "zustand";

const buttonStyle = {
  width: 20,
  height: 20,
  background: "#000",
  border: "1px solid #fff",
  cursor: "pointer",
  borderRadius: "50%",
  fontSize: "12px",
  lineHeight: 1,
};

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
}: EdgeProps<ButtonEdge>) {
  const { setEdges } = useReactFlow();

  const manifoldOptions = useStore(useFactory().store, state => state.manifoldOptions);
  const graph = useStore(useFactory().store, state => state.graph);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 1
  });

  const onEdgeClick = () => {
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  };
  const man = manifoldOptions.find(man => {
    return new Set(Object.keys(man.edges)).has(id)
  });
  const constraint = graph?.constraints[man?.constraintId || ""] || null;

  if (data?.highlight) {
    style.stroke = "#00ffdd";
    style.strokeWidth = 8;
  } else if (man?.free === true) {
    if (constraint?.parent !== undefined) {
      style.strokeWidth = 6;
      style.stroke = "#55dd55";
    } else {
      style.stroke = "#004400";
      style.strokeWidth = 4;
    }
  } else {
    style.strokeWidth = 2;
  }

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            // everything inside EdgeLabelRenderer has no pointer events by default
            // if you have an interactive element, set pointer-events: all
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <button style={buttonStyle} onClick={onEdgeClick}>
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
