import type { NodeTypes } from "@xyflow/react";
import RecipeNode, { type RecipeNode as RecipeNodeType} from "../RecipeNode";
import type { RecipeId } from "../loadJsonData";

export const initialNodes = [
  { 
    id: "lo-press_steam_condensation", 
    type: "recipe-node", 
    position: { x: -250, y: -300 }, 
    data: { recipeId: "lo-press_steam_condensation"as RecipeId } 
  },
  {
    id: "acid_mixing_1", 
    type: "recipe-node",
    position: { x: 50, y: 0 },
    data: { recipeId: "acid_mixing" as RecipeId },
  },
  { 
    id: "exhaust_filtering_1",  
    type: "recipe-node", 
    position: { x: -300, y: 0 }, 
    data: { recipeId: "exhaust_filtering" as RecipeId } 
  },
  {
    id: "turbinehighpress", 
    type: "recipe-node",
    position: { x: -550, y: -350 },
    data: { recipeId: "turbinehighpress" as RecipeId },
  },
] satisfies RecipeNodeType[];

export const nodeTypes = {
  "recipe-node": RecipeNode, 
} satisfies NodeTypes;

// Append the types of you custom edges to the BuiltInNode type
export type CustomNodeType = RecipeNodeType;
