export type MachineId = string // keyof typeof machineData;
export type RecipeId = "A Recipe ID" | "Some other Recipe ID"; // keyof typeof recipeData;
export type ProductId = "A Product String Example" | "Some other product"; // keyof typeof productData; // This was killing performance, it's used everywhere and is too large
export type CategoryId = "A Machine Category ID" | "Some other category"; // keyof typeof categoryData;
export const ProductId = (id: string) => id as ProductId;
export const RecipeId = (id: string) => id as RecipeId;
export const MachineId = (id: string) => id as MachineId;
export const CategoryId = (id: string) => id as CategoryId;

import untyped from "../../gameData";

export type GameData = {
  machines: Record<MachineId, MachineSerialized>  ;
  products: Record<ProductId, ProductSerialized>;
  recipes: Record<RecipeId, RecipeSerialized>;
};

const gameData = untyped as unknown as GameData

export type BuildCost = {
  id: ProductId;
  name: string;
  quantity: number;
}

type MachineBase = {
  id: MachineId;
  name: string;
  category_id: CategoryId;
  workers: number;
  workers_generated: number;
  maintenance_cost?: {
    id: ProductId;
    quantity: number;
  };
  maintenance_generated?: {
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
  isFarm: boolean;
  isBalancer?: boolean;
  footprint?: [number, number]; // [width, height] in game tiles
}


export type MachineSerialized = MachineBase & {
  recipes: RecipeId[];
  buildCosts: {
    id: ProductId;
    quantity: number;
  }[],
  cooling?: {
    input: RecipeProductSerialized[];
    output: RecipeProductSerialized[];
  },
}

export type Machine = MachineBase & {
  recipes: Recipe[];
  icon: string;
  buildCosts: {
    product: Product;
    quantity: number;
  }[],
  cooling?: {
    input: RecipeProduct[];
    output: RecipeProduct[];
  },
}

export type Category = {
  id: CategoryId;
  name: string;
  machines: MachineId[];
  recipes: RecipeId[];
}

export type ProductBase = {
  id: ProductId;
  name: string;
  icon: string;
  color: string; // Hex color code
  unit: string; // "{0} kW" | "{0} TFlops" | ""
  transport: "Flat" | "Loose" | "Pipe" | "Molten" | "Virtual"; // How this product is transported
  /** Whether this product is a scrap material (iron scrap, copper scrap, etc.) */
  isScrap?: boolean;
}

export type ProductSerialized = ProductBase & {
  recipes: {
    input: RecipeId[];
    output: RecipeId[];
  }
  machines: {
    input: MachineId[];
    output: MachineId[];
  }
}
export type Product = ProductBase & {
  recipes: {
    input: Recipe[];
    output: Recipe[];
  }
  machines: {
    input: Machine[];
    output: Machine[];
  }
}

export type RecipeProduct = {
  product: Product;
  quantity: number;
  optional?: boolean;
  integerScale?: true;
}

export type RecipeProductSerialized = {
  id: ProductId;
  quantity: number;
  optional?: boolean;
  integerScale?: true;
}

export type LevelRegime = {
  minLevel: number;
  maxLevel: number;
  base: {
    inputs: RecipeProduct[];
    outputs: RecipeProduct[];
    workers?: number;
  };
  delta: {
    inputs: RecipeProduct[];
    outputs: RecipeProduct[];
    workers?: number;
  };
}

export type LevelRegimeSerialized = {
  minLevel: number;
  maxLevel: number;
  base: {
    inputs: RecipeProductSerialized[];
    outputs: RecipeProductSerialized[];
    workers?: number;
  };
  delta: {
    inputs: RecipeProductSerialized[];
    outputs: RecipeProductSerialized[];
    workers?: number;
  };
}

export type RecipeBase = {
  id: RecipeId;
  name: string;
  type: "recipe" | "settlement" | "balancer" | "contract" | "thermal-storage" | "launch" | "space-station";
  tiersLink?: string;
  duration: number;
  origDuration: number;
  powerMult: number;
  /** Pre-computed at reformat time: recipe consumes maintenance products */
  isMaintenance: boolean;
  /** Pre-computed at reformat time: recipe produces maintenance products */
  isMaintenanceProducer: boolean;
  /** Pre-computed at reformat time: recipe's machine is a farm */
  isFarm: boolean;
  /** Pre-computed at reformat time: recipe's machine is a solar panel variant */
  usesSolarPower: boolean;
  isRainWaterHarvester: boolean;
  /** Default level for level-based recipes (currently only `space-station`).
   *  Resolved by `SpaceStationCalculator` and `RecipePicker.displayQty`. */
  defaultLevel?: number;
  /** Launch-cadence quantum. The LP rate `n` is constrained to a *positive integer
   *  multiple* of `minRate` (`n ∈ {minRate, 2·minRate, …}`). This both floors the rate
   *  at one event per cycle and quantizes it to whole events — e.g. crew launches happen
   *  at least once per 24-month cycle (`minRate = 1/24`), and a crew of 6 from a 4-seat
   *  rocket needs 2 whole launches per cycle, not 1.5. See `buildLpp` cycle vars. */
  minRate?: number;
}
export type Recipe = RecipeBase & {
  machine: Machine;
  inputs: RecipeProduct[];
  outputs: RecipeProduct[];
  levelRegimes?: LevelRegime[];
}

export type RecipeSerialized = RecipeBase & {
  machine: MachineId;
  inputs: RecipeProductSerialized[];
  outputs: RecipeProductSerialized[];
  levelRegimes?: LevelRegimeSerialized[];
}

export type GameDataParsed = {
  machines: Map<MachineId, Machine>;
  products: Map<ProductId, Product>;
  recipes: Map<RecipeId, Recipe>;
}

let loadedData: GameDataParsed | null = null;

export function loadData() {
  return loadedData || (loadedData = parseData());
}

export function parseData(unparsedData = gameData) {
  try {
    // Map all recipes and link their products and machine directly
    const newData = {
      machines: new Map<MachineId, Machine>,
      products: new Map<ProductId, Product>,
      recipes: new Map<RecipeId, Recipe>,
    }

    // setup machines and products
    for (const productId in unparsedData.products) {
      const product = unparsedData.products[productId as ProductId];
      const newProduct: Product = {
        ...product,
        recipes: {
          input: [],
          output: [],
        },
        machines: {
          input: [],
          output: [],
        },
      }
      newData.products.set(productId as ProductId, newProduct);
    }

    for (const machineId in unparsedData.machines) {
      const machine = unparsedData.machines[machineId];
      const newMachine: Machine = {
        ...machine,
        icon: machine.id,
        recipes: [],
        buildCosts: machine.buildCosts.map(cost => {
          const product = newData.products.get(cost.id);
          if (!product) {
            throw new Error(`Product ${cost.id} not found for machine ${machineId}`);
          }
          return {
            product: newData.products.get(cost.id)!,
            quantity: cost.quantity,
          }
        }),
        cooling: machine.cooling ? {
          input: machine.cooling.input.map(input => {
            const product = newData.products.get(input.id);
            if (!product) {
              throw new Error(`Product ${input.id} not found for machine ${machineId} cooling input`);
            }
            return {
              product: product,
              quantity: input.quantity,
              optional: input.optional,
            }
          }),
          output: machine.cooling.output.map(output => {
            const product = newData.products.get(output.id);
            if (!product) {
              throw new Error(`Product ${output.id} not found for machine ${machineId} cooling output`);
            }
            return {
              product: product,
              quantity: output.quantity,
              optional: output.optional,
            }
          }),
        } : undefined,
      }
      newData.machines.set(machineId, newMachine);
    }

    for (const key in unparsedData.recipes) {
      const recipeId = key as RecipeId;
      const recipe = unparsedData.recipes[recipeId];
      const machine = newData.machines.get(recipe.machine);
      if (!machine)
        throw new Error(`Machine ${recipe.machine} not found for recipe ${recipeId}`);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { levelRegimes: _serializedRegimes, ...recipeRest } = recipe;
      newData.recipes.set(recipeId, {
        ...recipeRest,
        machine: machine,
        inputs: [],
        outputs: [],
      });
      const newRecipe = newData.recipes.get(recipeId)!;
      machine.recipes.push(newRecipe);

      const mapRP = (p: RecipeProductSerialized): RecipeProduct => {
        const product = newData.products.get(p.id);
        if (!product) throw new Error(`Product ${p.id} not found in level regime for recipe ${recipeId}`);
        return {
          product,
          quantity: p.quantity,
          optional: p.optional || false,
          ...(p.integerScale ? { integerScale: true as const } : {}),
        };
      };
      if (recipe.levelRegimes) {
        newRecipe.levelRegimes = recipe.levelRegimes.map(r => ({
          minLevel: r.minLevel,
          maxLevel: r.maxLevel,
          base: { inputs: r.base.inputs.map(mapRP), outputs: r.base.outputs.map(mapRP), workers: r.base.workers },
          delta: { inputs: r.delta.inputs.map(mapRP), outputs: r.delta.outputs.map(mapRP), workers: r.delta.workers },
        }));
      }

      newRecipe.inputs = recipe.inputs.map(input => {
        const product = newData.products.get(input.id);
        if (!product) {
          throw new Error(`Product ${input.id} not found for recipe ${recipeId}`);
        }
        product.recipes.input.push(newRecipe);
        return {
          product: product,
          quantity: input.quantity,
          optional: input.optional || false,
          ...(input.integerScale ? { integerScale: true as const } : {}),
        }
      });
      newRecipe.outputs = recipe.outputs.map(output => {
        const product = newData.products.get(output.id);
        if (!product) {
          throw new Error(`Product ${output.id} not found for recipe ${recipeId}`);
        }
        product.recipes.output.push(newRecipe);
        return {
          product: product,
          quantity: output.quantity,
          optional: output.optional || false,
          ...(output.integerScale ? { integerScale: true as const } : {}),
        }
      });
    }

    return newData;

  } catch (error) {
    console.error("Error parsing game data:", error);
    throw "Failed to load data";
  }
}
