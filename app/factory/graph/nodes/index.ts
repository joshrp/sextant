import type { NodeTypes } from "@xyflow/react";
import RecipeNode, { type RecipeNode as RecipeNodeType} from "../RecipeNode";
import type { RecipeId } from "../loadJsonData";

export const initialNodes = [
  { 
    id: "SteamLpCondensation", 
    type: "recipe-node", 
    position: { x: -250, y: -300 }, 
    data: { type: "recipe", recipeId: "SteamLpCondensation" as RecipeId } 
  },
  {
    id: "AcidMixMixingT2", 
    type: "recipe-node",
    position: { x: 50, y: 0 },
    data: { type: "recipe", recipeId: "AcidMixMixingT2" as RecipeId },
  },
  { 
    id: "ExhaustFiltering",  
    type: "recipe-node", 
    position: { x: -300, y: 0 }, 
    data: { type: "recipe", recipeId: "ExhaustFiltering" as RecipeId } 
  },
  {
    id: "TurbineHighPressT2", 
    type: "recipe-node",
    position: { x: -550, y: -350 },
    data: { type: "recipe", recipeId: "TurbineHighPressT2" as RecipeId },
  },
] satisfies RecipeNodeType[];

export const nodeTypes = {
  "recipe-node": RecipeNode, 
} satisfies NodeTypes;

// Append the types of you custom edges to the BuiltInNode type
export type CustomNodeType = RecipeNodeType;
