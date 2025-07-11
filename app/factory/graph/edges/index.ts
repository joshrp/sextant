import type { BuiltInEdge, Edge, EdgeTypes } from "@xyflow/react";

import ButtonEdge, { type ButtonEdge as ButtonEdgeType } from "./ButtonEdge";

export const initialEdges = [
  { id: "a->c", 
    source: "fuelgas_reforming_1", 
    sourceHandle: "carbon_dioxide", 
    target: "fuelgas_synthesis_1", 
    targetHandle: "carbon_dioxide",
    animated: true ,
    type: "button-edge"
  },
  { id: "b->d", 
    source: "exhaust_filtering_1", 
    target: "acid_mixing_1", 
    sourceHandle: "sulfur",
    targetHandle: "sulfur",
    type: "button-edge" 
  },
  { 
    id: "c->d", 
    target: "fuelgas_synthesis_1", 
    source: "exhaust_filtering_1", 
    sourceHandle: "carbon_dioxide",
    targetHandle: "carbon_dioxide",
    animated: true 
  },
  { 
    id: "d->a", 
    source: "fuelgas_synthesis_1", 
    target: "fuelgas_reforming_1",
    sourceHandle: "fuel_gas",
    targetHandle: "fuel_gas",
    animated: true,
    type: "button-edge"
  },
] as ButtonEdgeType[];

export const edgeTypes = {
  // Add your custom edge types here!
  "button-edge": ButtonEdge,
} satisfies EdgeTypes;

// Append the types of you custom edges to the BuiltInEdge type
export type CustomEdgeType = BuiltInEdge | ButtonEdgeType;
