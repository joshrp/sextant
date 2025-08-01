import machineData from "data/machines.json"
import productData from "data/products.json"
import recipeData from "data/recipes.json"
import categoryData from "data/categories.json"

export type MachineId = string // keyof typeof machineData;
export type RecipeId = "A Recipe ID" | "Some other Recipe ID"; // keyof typeof recipeData;
export type ProductId = "A Product String Example" | "Some other product"; // keyof typeof productData; // This was killing performance, it's used everywhere and is too large
export type CategoryId = "A Machine Category ID" | "Some other category"; // keyof typeof categoryData;

export type BuildCost = {
  id: ProductId;
  name: string;
  quantity: number;
}

type MachineBase = {
  id: MachineId;
  game_id: string;
  icon: string;
  name: string;
  category_id: CategoryId;
  workers: number;
  maintenance_cost?: {
    id: ProductId;
    quantity: number;
  };
  electricity_consumed: number;
  electricity_generated: number;
  computing_consumed: number;
  computing_generated: number;
  storage_capacity: number;
  unity_cost: number;
  research_speed: number;
  isMine: boolean;
  isStorage: boolean;
  isFarm: boolean;
  cooling?: { // TODO:: Needs exporting
    input: ProductId[];
    output: ProductId[];
  },
}


export type MachineSerialized = MachineBase & {
  recipes: RecipeId[];
  buildCosts: {
    id: ProductId;
    quantity: number;
  }[]
}

export type Machine = MachineBase & {
  recipes: Recipe[];
  buildCosts: {
    product: Product;
    quantity: number;
  }
}

export type Category = {
  id: CategoryId;
  name: string;
  machines: MachineId[];
  recipes: RecipeId[];
}

export type Product = {
  id: ProductId;
  name: string;
  icon: string;
  color: string; // Hex color code
  unit: string; // "{0} kW" | "{0} TFlops" | ""
  recipes: {
    input: RecipeId[];
    output: RecipeId[];
  }
  machines: {
    input: MachineId[];
    output: MachineId[];
  }
}

export type RecipeProduct = {
  id: ProductId;
  quantity: number;
}

export type Recipe = {
  id: RecipeId;
  name: string;
  linkId?: string;
  machine: MachineId;
  duration: number; 
  origDuration: number;
  inputs: RecipeProduct[];
  outputs: RecipeProduct[];
}

export type MachineData = { [id in MachineId]: Machine }
export type RecipeData = { [id in RecipeId]: Recipe }
export type ProductData = { [id in ProductId]: Product }
export type CategoryData = { [id in CategoryId]: Category }

export const loadMachineData = () => {
  return machineData as unknown as MachineData
}

export const loadProductData = () => {
  return productData as unknown as ProductData
}

export const loadRecipeData = () => {
  return recipeData as unknown as RecipeData
}

export const loadCategoryData = () => {
  return categoryData as unknown as CategoryData
}

