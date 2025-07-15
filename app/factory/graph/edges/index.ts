import type { BuiltInEdge, Edge, EdgeTypes } from "@xyflow/react";

import ButtonEdge, { type ButtonEdge as ButtonEdgeType } from "./ButtonEdge";

export const initialEdges = [
  { id: "filtering->condensing", 
    source: "exhaust_filtering_1", 
    sourceHandle: "steam_lo", 
    target: "lo-press_steam_condensation", 
    targetHandle: "steam_lo",
    animated: true ,
    type: "button-edge"
  },
  { id: "filtering->acid_sulfur", 
    source: "exhaust_filtering_1", 
    target: "acid_mixing_1", 
    sourceHandle: "sulfur",
    targetHandle: "sulfur",
    animated: true,
    type: "button-edge" 
  },
  { 
    id: "condensing->filtering", 
    target: "exhaust_filtering_1", 
    source: "lo-press_steam_condensation", 
    sourceHandle: "water",
    targetHandle: "water",
    animated: true,
    type: "button-edge" 

  },
  { 
    id: "condensing->acid", 
    target: "acid_mixing_1", 
    source: "lo-press_steam_condensation", 
    sourceHandle: "water",
    targetHandle: "water",
    animated: true,
    type: "button-edge" 

  },
  { 
    id: "turbine->condensing", 
    source: "turbinehighpress", 
    target: "lo-press_steam_condensation",
    sourceHandle: "steam_lo",
    targetHandle: "steam_lo",
    animated: true,
    type: "button-edge"
  },
] as ButtonEdgeType[];

export const edgeTypes = {
  // Add your custom edge types here!
  "button-edge": ButtonEdge,
} satisfies EdgeTypes;

// Append the types of you custom edges to the BuiltInEdge type
export type CustomEdgeType = ButtonEdgeType;
