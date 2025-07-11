import type { BuiltInNode, Node, NodeTypes } from "@xyflow/react";
import PositionLoggerNode, {
  type PositionLoggerNode as PositionLoggerNodeType,
} from "./PositionLoggerNode";
import RecipeNode, { type RecipeNode as RecipeNodeType} from "../RecipeNode";

export const initialNodes = [
  { 
    id: "fuelgas_reforming_1", 
    type: "recipe-node", 
    position: { x: 0, y: 0 }, 
    data: { recipeId: "fuelgas_reforming" } 
  },
  {
    id: "acid_mixing_1", 
    type: "recipe-node",
    position: { x: -200, y: 200 },
    data: { recipeId: "acid_mixing" },
  },
  { 
    id: "exhaust_filtering_1",  
    type: "recipe-node", 
    position: { x: -500, y: 250 }, 
    data: { label: "your ideas", recipeId: "exhaust_filtering" } 
  },
  {
    id: "fuelgas_synthesis_1", 
    type: "recipe-node",
    position: { x: 50, y: 450 },
    data: { label: "with React Flow", recipeId: "fuelgas_synthesis" },
  },
] satisfies RecipeNodeType[];

export const nodeTypes = {
  "recipe-node": RecipeNode, 
} satisfies NodeTypes;

// Append the types of you custom edges to the BuiltInNode type
export type CustomNodeType = RecipeNodeType;
