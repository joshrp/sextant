

import * as ColorThief from "colorthief";
import { assert } from "node:console";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import type { Machine, MachineId, MachineSerialized, Product, ProductId, ProductSerialized, Recipe, RecipeId, RecipeSerialized } from "../app/factory/graph/loadJsonData";
import path from "node:path";

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
  },
  footprint?: [number, number]; // [width, height] in game tiles
};

type SerializedData = {
  products: Map<ProductId, ProductSerialized>;
  machines: Map<MachineId, MachineSerialized>;
  recipes: Map<RecipeId, RecipeSerialized>;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  reformatRawData().catch(err => {
    console.error("Error reformatting raw data:", err);
    process.exit(1);
  });
}
export async function reformatRawData(): Promise<void> {
  const allData = await getDataFromRaw();
  writeRawData(allData, "./app/gameData.ts");
  console.log("Reformatted raw data written to ./app/gameData.ts");
}

export async function getDataFromRaw(rawPath = "./data/raw"): Promise<SerializedData> {
  const machinesAndBuildings = readFileSync(path.join(rawPath, "machines_and_buildings.json"), { encoding: "utf-8" });
  const products = readFileSync(path.join(rawPath, "products.json"), { encoding: "utf-8" });
  const productData = await formatProductData(JSON.parse(products).products as RawProduct[]);
  const machineData = await initialMachineAndRecipeData(JSON.parse(machinesAndBuildings).machines_and_buildings, productData);

  return {
    products: machineData.products,
    machines: machineData.machines,
    recipes: machineData.recipes,
  };
}

export function writeRawData(allData: SerializedData, path = "./data/data.ts"): void {
  writeFileSync(path, `
    export default ${JSON.stringify({
    products: Object.fromEntries(allData.products),
    machines: Object.fromEntries(allData.machines),
    recipes: Object.fromEntries(allData.recipes),
  }, null, 2)
    }`, { encoding: "utf-8" });
}


async function getImageColors(iconPath: string, name: string): Promise<number[][]> {
  let rgbs = [[255, 255, 255]] as number[][];

  try {
    const buf = readFileSync(`public/assets/products/${iconPath}`);
    if (!buf || buf.length === 0) {
      throw new Error(`Icon file for product ${name} (${iconPath}) is empty. Please check the icon path.`);
    }
    // Grab 4 colors using sample size of 1px, it's a small icon and perf isn't a concern here
    const thief = (await ColorThief.getPalette(buf, 4, 1));
    if (!thief || thief.length === 0) {
      throw new Error(`Could not extract color from icon file for product ${name} (${iconPath}).`);
    }
    rgbs = thief;
  } catch (error) {
    console.warn(`Error extracting color from icon file for product ${name} (${iconPath}):`, error);
  }

  return rgbs;
}


function sanitizeFileName(fileName: string): string {
  // Remove any characters that are not alphanumeric, underscore, or hyphen
  return fileName.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
}

const transportTypes = [{
  type: "Flat",
  storage: "StorageUnitT4",
}, {
  type: "Loose",
  storage: "StorageLooseT4",
}, {
  type: "Pipe",
  storage: "StorageFluidT4",
}, {
  type: "Molten",
  storage: "None",
}, {
  type: "Virtual",
  storage: "None",
}] as const;

export async function formatProductData(rawProducts: RawProduct[]) {
  const productData = new Map<string, ProductSerialized>();

  for (const rawProduct of rawProducts) {
    assert(productData.has(rawProduct.name) === false, `Product ${rawProduct.name} already exists in product data.`);
    const iconPath = sanitizeFileName(rawProduct.icon) + ".png";
    // const imageExists = statSync(`public/assets/products/${iconPath}`, { throwIfNoEntry: false })?.isFile();
    // if (!imageExists) {
    // throw new Error(`Icon file for product ${rawProduct.name} (${iconPath}) does not exist. Please check the icon path.`);
    // console.warn(`Icon file for product ${rawProduct.name} (${iconPath}) does not exist. Skipping`);
    // continue;
    // }

    let color = '';
    if (rawProduct.color)
      color = formatColor(rawProduct.color);
    else {
      const rgbs = await getImageColors(iconPath, rawProduct.name);

      // Some products like crushed ore, powder, yellowcake, etc. 
      //  have a prominent color that is not helpful, so we use the second color.
      if (rawProduct.name.match(/(crushed)|(powder)|(yellowcake)|(concentrate)|(sulfur)|(station)|(waste)|(lens)/i))
        color = rgbToHex(rgbs[1][0], rgbs[1][1], rgbs[1][2]);
      else
        color = rgbToHex(rgbs[0][0], rgbs[0][1], rgbs[0][2]);
    }

    let transport: ProductSerialized["transport"] = "Virtual";
    switch (rawProduct.type) {
      case "CountableProductProto":
        transport = "Flat";
        break;
      case "LooseProductProto":
        transport = "Loose";
        break;
      case "FluidProductProto":
        transport = "Pipe";
        break;
      case "MoltenProductProto":
        transport = "Molten";
        break;
      case "VirtualProductProto":
        transport = "Virtual";
        break;
      default:
        console.warn(`Unknown product type ${rawProduct.type} for product ${rawProduct.name}, defaulting to Flat transport.`);
    }

    productData.set(rawProduct.name, {
      id: rawProduct.id as Product["id"],
      name: rawProduct.name,
      icon: sanitizeFileName(rawProduct.icon) + ".png",
      color: color,
      transport,
      unit: rawProduct.unit.replace("{0}", "").trim(), // Remove the {0} from the unit
      recipes: { input: [], output: [] },
      machines: { input: [], output: [] },
    });
  }

  // Used for footprint calculations
  productData.set("Product_Virtual_Footprint", {
    id: "Product_Virtual_Footprint" as Product["id"],
    name: "Footprint",
    icon: "footprint.png",
    color: "#808080",
    transport: "Virtual",
    unit: "tiles",
    recipes: { input: [], output: [] },
    machines: { input: [], output: [] },
  });

  // Wildcard product for buffer passthroughs
  productData.set("Product_Virtual_Wildcard", {
    id: "Product_Virtual_Wildcard" as Product["id"],
    name: "Wildcard",
    icon: "wildcard.png",
    color: "#808080",
    transport: "Virtual",
    unit: "",
    recipes: { input: [], output: [] },
    machines: { input: [], output: [] },
  });

  return productData;
}

function getRecipeQty60(io: RawRecipe["inputs" | "outputs"][0], duration: number): number {
  // Mech power doesn't scale with duration
  if (io.name === "Mechanical power") return io.quantity
  return (io.quantity * 60) / duration;
}

export async function initialMachineAndRecipeData(rawMachinesAndBuildings: RawMachine[], products: Awaited<ReturnType<typeof formatProductData>>) {
  const machineData = new Map<MachineId, MachineSerialized>();
  const recipeData = new Map<RecipeId, RecipeSerialized>();

  const dupedRecipes = new Map<string, RecipeId[]>();

  for (const rawMachine of rawMachinesAndBuildings) {

    const machine: Partial<MachineSerialized> = {
      id: rawMachine.id as Machine["id"],
      name: rawMachine.name,
      category_id: rawMachine.category as Machine["category_id"],
      workers: rawMachine.workers,
      recipes: [],
      buildCosts: rawMachine.build_costs.map(cost => {
        assert(products.has(cost.product), `Product ${cost.product} not found in product data.`);
        return {
          id: products.get(cost.product)!.id,
          quantity: cost.quantity,
        }
      }),
      isFarm: false, // TODO: Maybe don't need this?
      isBalancer: false,
      electricity_consumed: rawMachine.electricity_consumed,
      electricity_generated: rawMachine.electricity_generated,
      computing_consumed: rawMachine.computing_consumed,
      computing_generated: rawMachine.computing_generated,
      storage_capacity: rawMachine.storage_capacity,
      unity_cost: rawMachine.unity_cost,
      research_speed: rawMachine.research_speed,
      footprint: rawMachine.footprint,
      // icon_path: rawMachine.icon_path,
    }

    if (rawMachine.maintenance_cost_units && rawMachine.maintenance_cost_quantity > 0) {
      assert(products.has(rawMachine.maintenance_cost_units), `Product ${rawMachine.maintenance_cost_units} not found in product data.`);
      machine.maintenance_cost = {
        id: products.get(rawMachine.maintenance_cost_units)?.id as Product["id"],
        quantity: rawMachine.maintenance_cost_quantity,
      };
    }

    // if (rawMachine.coolant) {
    //   assert(products.has(rawMachine.coolant.productIn), `Product ${rawMachine.coolant.productIn} not found in product data.`);
    //   assert(products.has(rawMachine.coolant.productOut), `Product ${rawMachine.coolant.productOut} not found in product data.`);
    //   machine.cooling = {
    //     input: [{
    //       id: products.get(rawMachine.coolant.productIn)!.id,
    //       quantity: rawMachine.coolant.quantityIn,
    //       ...(rawMachine.coolant.optional ? { optional: true } : {}),
    //     }],
    //     output: [{
    //       id: products.get(rawMachine.coolant.productOut)!.id,
    //       quantity: rawMachine.coolant.quantityOut,
    //       ...(rawMachine.coolant.optional ? { optional: true } : {}),
    //     }],
    //   }
    // }

    // Research Labs and Maintenance Depots have optional recycling in game, but this is modeled as multiple recipes
    // We want to collapse these into a single recipe with optional outputs to avoid clutter in the UI 
    // and to allow fractional outputs of recycled items
    if (rawMachine.id.startsWith("ResearchLab") && !rawMachine.id.endsWith("T1")) {
      if (rawMachine.recipes.length > 1) {
        console.warn(`Collapsing recipes for ${rawMachine.id} to only recipes with outputs and making them optional.`);
        rawMachine.recipes = rawMachine.recipes.filter(r => r.outputs.length > 0);
        rawMachine.recipes.forEach(r => r.outputs.forEach(o => o.optional = true));
      }
    }
    if (rawMachine.id.startsWith("MaintenanceDepot") && !rawMachine.id.endsWith("T0")) {
      if (rawMachine.recipes.length > 1) {
        console.warn(`Collapsing recipes for ${rawMachine.id} to only recipes with Recycling outputs and making them optional.`);
        rawMachine.recipes = rawMachine.recipes.filter(r => r.outputs.find(o => o.name === "Recyclables"));
        rawMachine.recipes.forEach(r => r.outputs.forEach(o => o.name == "Recyclables" ? o.optional = true : null));
      }
    }

    for (const rawRecipe of rawMachine.recipes) {
      let newRecipeId = rawRecipe.id as Recipe["id"];
      const duration = rawRecipe.duration || 60; // Default to 60 seconds if no duration is specified

      if (recipeData.has(newRecipeId)) {
        const num = newRecipeId.match(/^(.*)_(\d+)$/);
        // if there's an int on the end of the recipe ID, increment it
        // if not, it's _1
        if (num) {
          const baseId = num[1];
          const newNum = parseInt(num[2], 10) + 1;
          newRecipeId = `${baseId}_${newNum}` as Recipe["id"];
        } else
          newRecipeId = `${newRecipeId}_1` as Recipe["id"];
      }

      const inputs = rawRecipe.inputs.map(input => {
        const existingProduct = products.get(input.name);
        assert(existingProduct, `Product ${input.name} not found in product data.`);
        existingProduct!.recipes.input.push(newRecipeId);
        return {
          id: existingProduct!.id,
          quantity: getRecipeQty60(input, duration),
        }
      });

      const outputs = rawRecipe.outputs.map(output => {
        const existingProduct = products.get(output.name);
        assert(existingProduct, `Product ${output.name} not found in product data.`);
        existingProduct!.recipes.output.push(newRecipeId);
        return {
          id: existingProduct!.id,
          quantity: getRecipeQty60(output, duration),
          ...(output.optional ? { optional: true } : {}),
        }
      });

      let tierId = undefined as string | undefined;
      const dedupKey = makeRecipeDeduplicationKey(inputs, outputs);

      if (dupedRecipes.has(dedupKey)) {
        tierId = dedupKey;
        dupedRecipes.get(dedupKey)!.push(newRecipeId);
        const first = dupedRecipes.get(dedupKey)![0];
        recipeData.get(first)!.tiersLink = tierId as Recipe["id"];
        
      } else
        dupedRecipes.set(dedupKey, [newRecipeId]);

      const recipe: RecipeSerialized = {
        id: newRecipeId as Recipe["id"],
        name: rawRecipe.name,
        tiersLink: tierId,
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

  for (const transport of transportTypes) {
    const machine: MachineSerialized = {
      id: `Balancer${transport.type}` as MachineId,
      name: `Balancer`,
      category_id: "Balancer" as Machine["category_id"],
      workers: 0,
      recipes: [],
      buildCosts: [],
      isBalancer: true,
      isFarm: false,
      electricity_consumed: 0,
      electricity_generated: 0,
      computing_consumed: 0,
      computing_generated: 0,
      storage_capacity: 0,
      unity_cost: 0,
      research_speed: 0,
      footprint: [0,0],
    };
    machineData.set(machine.id, machine);
  }

  const productsById: Map<ProductId, ProductSerialized> = new Map();
  for (const product of products.values()) {
    productsById.set(product.id, product);

    // Make a Balancer recipe for all products, add them to the Balancer machine matching their transport type
    const transport = transportTypes.find(t => t.type === product.transport)!;
    assert(transport, `Transport type ${product.transport} not found for product ${product.name}.`);
    const BalancerMachineId = `Balancer${transport.type}` as MachineId;
    const machine = machineData.get(BalancerMachineId)!;
    assert(machine, `Balancer machine ${BalancerMachineId} not found for product ${product.name}.`);
    const BalancerRecipeId = `Balancer_${product.id}` as RecipeId;

    // Add a Balancer machine and recipe that can pass any item through unchanged
    const BalancerRecipe: RecipeSerialized = {
      id: BalancerRecipeId,
      name: "Balancer Passthrough",
      duration: 60,
      origDuration: 60,
      machine: BalancerMachineId,
      inputs: [{ id: product.id, quantity: 1 }],
      outputs: [{ id: product.id, quantity: 1 }],
    };
    recipeData.set(BalancerRecipe.id, BalancerRecipe);
    machine.recipes.push(BalancerRecipe.id);
    product.recipes.input.push(BalancerRecipe.id);
    product.recipes.output.push(BalancerRecipe.id);
    product.machines.input.push(BalancerMachineId);
    product.machines.output.push(BalancerMachineId);
  }

  return {
    machines: machineData,
    recipes: recipeData,
    products: productsById,
  };
}


/**
 * Generate a deduplication key for recipes based on their inputs and outputs.
 * This key is used to identify recipes that are functionally the same, even if they have different IDs.
 * 
 * Outputs are listed with their inputs at ratio, with a placeholder for no outputs / inputs.
 */
const makeRecipeDeduplicationKey = (inputs: RecipeSerialized["inputs"], outputs: RecipeSerialized["outputs"]) => {
  const emptyProduct = [{ id: "None", quantity: 1 }];
  const key = (outputs.length > 0 ? outputs : emptyProduct).sort().map(output => {
    return `${output.id}:${(inputs.length > 0 ? inputs : emptyProduct).sort().map(i => `${i.id}:${i.quantity / output.quantity}`).join('+')}`;
  }).join(',');
  return createHash("shake256", { outputLength: 32 }).update(key).digest("hex");
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

function formatColor(rawColor: RawProduct["color"]): string {
  // Convert the raw color from (r, g, b, a) format to hex format
  const rgba = rawColor.replace(/[()]/g, "").split(",").map(Number);
  const [r, g, b] = rgba;
  return rgbToHex(r, g, b);
}
