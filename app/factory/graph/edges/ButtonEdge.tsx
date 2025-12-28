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
import { useStore } from "zustand";
import useFactory from "~/factory/FactoryContext";
import { loadData, type ProductId } from "../loadJsonData";
import { useCallback, useState } from "react";

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

  const manifoldOptions = useStore(useFactory().store, state => state.manifoldOptions);
  const nodes = useFactory().store.getState().nodes;

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
    console.error('Error finding Smart Edge Path', getSmartEdgeResponse);
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

  const classes = ["baseEdge"];
  if (data?.highlight || hasSelectedHandle)
    classes.push("highlightFlow");

  if (man?.free === true)
    classes.push("edgeAlert", "highlightFlow");

  style.stroke = productColor;
  const buttonStyle: Record<string, string> = {
    borderColor: productColor
  };
  return (
    <>
      <BaseEdge path={svgPathString} markerEnd={markerEnd} style={style} className={classes.join(' ')} />
      <EdgeLabelRenderer>
        <div
          style={{
            display: selected ? "block" : "none",
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${edgeCenterX}px,${edgeCenterY}px)`,
            fontSize: 16,
            zIndex: 1500,
            // everything inside EdgeLabelRenderer has no pointer events by default
            // if you have an interactive element, set pointer-events: all
            pointerEvents: "all",
          }}
          className="nodrag nopan edgeDeleteButton"
        >
          <button style={buttonStyle} onClick={onEdgeClick}>
            × {classes.join(',')}
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
