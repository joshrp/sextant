import type { EdgeTypes } from "@xyflow/react";

import ButtonEdge, { type ButtonEdge as ButtonEdgeType } from "./ButtonEdge";

export const initialEdges = [
  { id: "filtering->condensing", 
    source: "ExhaustFiltering", 
    sourceHandle: "Product_SteamLP", 
    target: "SteamLpCondensation", 
    targetHandle: "Product_SteamLP",
    animated: true ,
    type: "button-edge"
  },
  { id: "filtering->acid_sulfur", 
    source: "ExhaustFiltering", 
    target: "AcidMixMixingT2", 
    sourceHandle: "Product_Sulfur",
    targetHandle: "Product_Sulfur",
    animated: true,
    type: "button-edge" 
  },
  { 
    id: "condensing->filtering", 
    target: "ExhaustFiltering", 
    source: "SteamLpCondensation", 
    sourceHandle: "Product_Water",
    targetHandle: "Product_Water",
    animated: true,
    type: "button-edge" 

  },
  { 
    id: "condensing->acid", 
    target: "AcidMixMixingT2", 
    source: "SteamLpCondensation", 
    sourceHandle: "Product_Water",
    targetHandle: "Product_Water",
    animated: true,
    type: "button-edge" 

  },
  { 
    id: "turbine->condensing", 
    source: "TurbineHighPressT2", 
    target: "SteamLpCondensation",
    sourceHandle: "Product_SteamLP",
    targetHandle: "Product_SteamLP",
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
