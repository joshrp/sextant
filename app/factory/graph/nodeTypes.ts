/**
 * Pure node type definitions and type guards — no component imports.
 * Import from here in non-component code (store, solver, importexport, etc.)
 * to avoid coupling the serialization/logic layer to React component code.
 */
import type { RecipeNodeType } from './recipeNodeLogic';
import type { AnnotationNodeType } from './annotationNode';

export type { RecipeNodeType, AnnotationNodeType };

// Append the types of your custom nodes to this union
export type CustomNodeType = RecipeNodeType | AnnotationNodeType;

/**
 * Type guard: is this node a recipe-node (recipe/balancer/settlement)?
 */
export function isRecipeNode(node: CustomNodeType): node is RecipeNodeType {
  return node.type === "recipe-node";
}

/**
 * Type guard: is this node an annotation-node?
 */
export function isAnnotationNode(node: CustomNodeType): node is AnnotationNodeType {
  return node.type === "annotation-node";
}
