import MachinesAndBuildings from "./raw/machines_and_buildings.json";
import RawProducts from "./raw/products.json";

import { assert } from "node:console";
import { createHash } from "node:crypto";
import type { Machine, MachineSerialized, Product, Recipe } from "../app/factory/graph/loadJsonData";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import ColorThief from "colorthief";

const raw = {
  products: RawProducts,
  machinesAndBuildings: MachinesAndBuildings,
};

type RawProduct = {
  id: string;
  name: string;
  icon: string;
  type: string;
  icon_path: string;
  color: string; // (0, 0, 0, 0) rgba format
  unit: string; // "{0} kW" | "{0} TFlops" | ""
};

type RawRecipe = {
  id: string;
  name: string;
  duration: number;
  power_multiplier: number;
  inputs: {
    name: string; 
    quantity: number;
    optional?: boolean;
  }[];
  outputs: {
    name: string; 
    quantity: number;
    optional?: boolean;
  }[];
};

type RawMachine = {
  id: string;
  name: string;
  category: string;
  next_tier: string;
  workers: number;
  maintenance_cost_units: string;
  maintenance_cost_quantity: number;
  electricity_consumed: number;
  electricity_generated: number;
  computing_consumed: number;
  computing_generated: number;
  storage_capacity: number;
  unity_cost: number;
  research_speed: number;
  icon_path: string;
  recipes: RawRecipe[];
  build_costs: {
    /* Product Name */
    product: string;
    quantity: number;
  }[],
  coolant?: {
    productIn: string; 
    productOut: string; 
    quantityIn: number; 
    quantityOut: number; 
    optional: boolean; // Whether the coolant is optional
  }
};

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1<<24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

function formatColor(rawColor: RawProduct["color"]): string {
  // Convert the raw color from (r, g, b, a) format to hex format
  const rgba = rawColor.replace(/[()]/g, "").split(",").map(Number);
  const [r, g, b] = rgba;
  if (r == 0 && g == 0 && b == 0) {
    return "#ffffff";
  }
  return rgbToHex(r, g, b);
}

async function getImageColors(iconPath: string, name: string): Promise<number[][]> {
  const buf = readFileSync(`public/assets/products/${iconPath}`);
  if (!buf || buf.length === 0) {
    throw new Error(`Icon file for product ${name} (${iconPath}) is empty. Please check the icon path.`);
  }
  // Grab 4 colors using sample size of 1px, it's a small icon and perf isn't a concern here
  const rgbs = (await ColorThief.getPalette(buf, 4, 1));
  if (!rgbs || rgbs.length === 0) {
    throw new Error(`Could not extract color from icon file for product ${name} (${iconPath}).`);
  }
  return rgbs;
}

function sanitizeFileName(fileName: string): string {
  // Remove any characters that are not alphanumeric, underscore, or hyphen
  return fileName.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
}

export async function initialProductData() {
  const productData = new Map<string, Product>();
  
  for (const rawProduct of raw.products.products as RawProduct[]) {
    assert(productData.has(rawProduct.name) === false, `Product ${rawProduct.name} already exists in product data.`);
    const iconPath = sanitizeFileName(rawProduct.icon) + ".png";
    const imageExists = statSync(`public/assets/products/${iconPath}`, { throwIfNoEntry: false })?.isFile();
    if (!imageExists) {
      // throw new Error(`Icon file for product ${rawProduct.name} (${iconPath}) does not exist. Please check the icon path.`);
      // console.warn(`Icon file for product ${rawProduct.name} (${iconPath}) does not exist. Skipping`);
      // continue;
    }

    // If the color is white, try to extract the color from the icon file
    let color = formatColor(rawProduct.color);
    if (color === "#ffffff") {
      try {
        const rgbs = await getImageColors(rawProduct.icon, rawProduct.name);

        // Some products like crushed ore, powder, yellowcake, etc. have a prominent color that is not helpful, so we use the second.
        color = rgbToHex(rgbs[0][0], rgbs[0][1], rgbs[0][2]);
        if (rawProduct.name.match(/(crushed)|(powder)|(yellowcake)|(concentrate)|(sulfur)|(station)|(waste)|(lens)/i)) {
          color = rgbToHex(rgbs[1][0], rgbs[1][1], rgbs[1][2]);          
        }
        
      } catch(error) {
        console.error(`Could not extract color for ${rawProduct.name}:`, error);
      }
    }

    productData.set(rawProduct.name, {
      id: rawProduct.id as Product["id"],
      name: rawProduct.name,
      icon: sanitizeFileName(rawProduct.icon) + ".png",
      color: color,
      unit: rawProduct.unit.replace("{0}", "").trim(), // Remove the {0} from the unit
      recipes: { input: [], output: [] },
      machines: { input: [], output: [] },
    });
  }
  return productData;
}

function getRecipeQty60(io: RawRecipe["inputs" | "outputs"][0], duration: number): number {
  // Convert the io quantity to a per-minute basis
  if (io.name === "Mechanical power") return io.quantity
  return (io.quantity * 60) / duration;
}

export async function initialMachineAndRecipeData(products?: Map<string, Product>) {
  if (!products) {
    products = await initialProductData();
  }
  const machineData = new Map<string, MachineSerialized>();
  const recipeData = new Map<string, Recipe>();

  const dupedRecipes = new Set<string>();

  for (const rawMachine of raw.machinesAndBuildings.machines_and_buildings as RawMachine[]) {
    const machine: Partial<MachineSerialized> = {
      id: rawMachine.id as Machine["id"],
      name: rawMachine.name,
      category_id: rawMachine.category as Machine["category_id"],
      workers: rawMachine.workers,
      recipes: [],
      buildCosts: rawMachine.build_costs.map(cost => ({
        id: cost.product as Product["id"],
        quantity: cost.quantity,
      })),
      isFarm: false, // TODO: Maybe don't need this?
      electricity_consumed: rawMachine.electricity_consumed,
      electricity_generated: rawMachine.electricity_generated,
      computing_consumed: rawMachine.computing_consumed,
      computing_generated: rawMachine.computing_generated,
      storage_capacity: rawMachine.storage_capacity,
      unity_cost: rawMachine.unity_cost,
      research_speed: rawMachine.research_speed,
      // icon_path: rawMachine.icon_path,
    }

    if (rawMachine.maintenance_cost_units && rawMachine.maintenance_cost_quantity > 0) {
      assert(products.has(rawMachine.maintenance_cost_units), `Product ${rawMachine.maintenance_cost_units} not found in product data.`);
      machine.maintenance_cost = {
        id: products.get(rawMachine.maintenance_cost_units)?.id as Product["id"],
        quantity: rawMachine.maintenance_cost_quantity,
      };
    }

    for (const rawRecipe of rawMachine.recipes) {
      let newRecipeId = rawRecipe.id;
      const duration = rawRecipe.duration || 60; // Default to 60 seconds if no duration is specified
      
      if (recipeData.has(newRecipeId)) {
        const num = newRecipeId.match(/^(.*)_(\d+)$/);
        // if there's an int on the end of the recipe ID, increment it
        // if not, it's _1
        if (num) {
          const baseId = num[1];
          const newNum = parseInt(num[2], 10) + 1;
          newRecipeId = `${baseId}_${newNum}`;
        } else
          newRecipeId = `${newRecipeId}_1`;
      }

      const inputs = rawRecipe.inputs.map(input => {
        const existingProduct = products.get(input.name);
        assert(existingProduct, `Product ${input.name} not found in product data.`);
        existingProduct!.recipes.input.push(newRecipeId as Recipe["id"]);
        return {
          id: existingProduct!.id,
          quantity: getRecipeQty60(input, duration),
          ...(input.optional ? { optional: true } : {}),
        }
      });

      const outputs = rawRecipe.outputs.map(output => {
        const existingProduct = products.get(output.name);
        assert(existingProduct, `Product ${output.name} not found in product data.`);
        existingProduct!.recipes.output.push(newRecipeId as Recipe["id"]);

        return {
          id: existingProduct!.id,
          quantity: getRecipeQty60(output, duration),
          ...(output.optional ? { optional: true } : {}),
        }
      });

      let tierId = undefined as string | undefined;
      const dedupKey = makeRecipeDeduplicationKey(inputs, outputs);

      // TODO:: Don't store as a set, need a map of involved recipes to backfill the link ID to
      if (dupedRecipes.has(dedupKey)) {
        tierId = dedupKey;
      } else
        dupedRecipes.add(dedupKey);

      const recipe: Recipe = {
        id: newRecipeId as Recipe["id"],
        name: rawRecipe.name,
        linkId: tierId,
        machine: rawMachine.id as Machine["id"],
        origDuration: duration,
        duration: 60, // This is the default with no exceptions... yet
        inputs,
        outputs,
      };

      recipeData.set(newRecipeId, recipe);

      // Add the recipe to the products
      (machine.recipes ||= []).push(newRecipeId as Recipe["id"]);
    }

    machineData.set(rawMachine.id, machine as MachineSerialized);
  }

  const productsById: Record<string, Product> = {};
  for (const product of products.values()) {
    productsById[product.id] = product;
  }
  writeFileSync("data/test_machines.json", JSON.stringify(Object.fromEntries(machineData.entries()), null, 2));
  writeFileSync("data/test_recipes.json", JSON.stringify(Object.fromEntries(recipeData.entries()), null, 2));
  writeFileSync("data/test_products.json", JSON.stringify(productsById, null, 2));
  console.log("Wrote test data to data/test_machines.json, data/test_recipes.json, and data/test_products.json");
  return { machines: machineData, recipes: recipeData, products: productsById };
}


/**
 * Generate a deduplication key for recipes based on their inputs and outputs.
 * This key is used to identify recipes that are functionally the same, even if they have different IDs.
 * 
 * Outputs are listed with their inputs at ratio, with a placeholder for no outputs / inputs.
 */
const makeRecipeDeduplicationKey = (inputs: Recipe["inputs"], outputs: Recipe["outputs"]) => {
  const emptyProduct = [{ id: "None", quantity: 1 }];
  const key = (outputs.length > 0 ? outputs : emptyProduct).sort().map(output => {
    return `${output.id}:${(inputs.length > 0 ? inputs : emptyProduct).sort().map(i => `${i.id}:${i.quantity / output.quantity}`).join('+')}`;
  }).join(',');
  return createHash("shake256", { outputLength: 32 }).update(key).digest("hex");
}
