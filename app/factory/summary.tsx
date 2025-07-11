import { useShallow } from "zustand/shallow";
import useStore, { type GraphStore } from "./store";
import { getOutgoers, type EdgeChange, type EdgeTypes } from "@xyflow/react";
import { useState } from "react";

// const selector = (state: GraphStore) => ({
//   nodes: state.nodes,
//   edges: state.edges,
//   onNodesChange: state.onNodesChange,
//   onEdgesChange: state.onEdgesChange,
//   onConnect: state.onConnect,
// });

export default function FactorySummary() {
  const constraints = useStore((state) => state.constraints);

  return (
    <div>

      <p>{JSON.stringify(constraints)}</p>
    </div>
  );
}
