import { parseData, type GameData, type ProductId, type RecipeId } from "~/factory/graph/loadJsonData";
import { getDataFromRaw, writeRawData } from "./reformat";

import { beforeAll, describe, expect, test } from 'vitest';

describe("Check refomatted data", () => {
  let allData: Awaited<ReturnType<typeof getDataFromRaw>>;
  beforeAll(async () => {
    allData = await getDataFromRaw();
    writeRawData(allData, "./data_test.json");
  });

  test("Load product data", () => {
    const products = allData.products;
    expect(products).toBeDefined();
    expect(products.size).toBeGreaterThan(0);
    expect(products.get("Product_Virtual_MaintenanceT2" as ProductId)).toBeDefined();
    expect(products.get("Product_Virtual_MaintenanceT2" as ProductId)?.name).toBe("Maintenance II");
    expect(products.get("Product_Virtual_MaintenanceT2" as ProductId)?.icon).toBe("maintenance2.png");
  });

  test("Load machine & recipe data", () => {
    const { machines } = allData;
    const assembler2 = machines.get("AssemblyRoboticT1");
    expect(assembler2).toBeDefined();
    expect(assembler2?.name).toBe("Assembly IV");
    expect(assembler2?.workers).toBe(2);
    expect(assembler2?.maintenance_cost?.id).toBe("Product_Virtual_MaintenanceT2");
    expect(assembler2?.maintenance_cost?.quantity).toBe(4);
    
  });
  //   [ 134, 134, 134 ],
  // [ 58, 123, 58 ],

  test("All recipes with a link ID should have the same input and output products", () => {
    const { recipes } = allData;
    const linkIdMap = new Map<string, { inputs: Set<string>, outputs: Set<string> }>();

    for (const recipe of recipes.values()) {
      if (recipe.tiersLink) {
        if (!linkIdMap.has(recipe.tiersLink)) {
          linkIdMap.set(recipe.tiersLink, {
            inputs: new Set(recipe.inputs.map(i => i.id)),
            outputs: new Set(recipe.outputs.map(o => o.id)),
          });
        } else {
          const { inputs, outputs } = linkIdMap.get(recipe.tiersLink)!;
          expect(new Set(recipe.inputs.map(i => i.id)), `checking inputs for ${recipe.id}`).toEqual(inputs);
          expect(new Set(recipe.outputs.map(o => o.id)), `checking outputs for ${recipe.id}`).toEqual(outputs);
        }
      }
    }
    expect(linkIdMap.size).toBeLessThan(recipes.size / 2);
  })

  test("All products should have their relevant recipes in their array", async () => {
    const { recipes, products } = allData;
    for (const recipe of recipes.values()) {
      for (const input of recipe.inputs) {
        const product = products.get(input.id);
        expect(product, `Product ${input.id} not found for recipe ${recipe.id}`).toBeDefined();
        expect(product?.recipes.input.includes(recipe.id), `Recipe ${recipe.id} not found in input recipes for product ${input.id}`).toBe(true);
      }
      for (const output of recipe.outputs) {
        const product = products.get(output.id);
        expect(product, `Product ${output.id} not found for recipe ${recipe.id}`).toBeDefined();
        expect(product?.recipes.output.includes(recipe.id), `Recipe ${recipe.id} not found in output recipes for product ${output.id}`).toBe(true);
      }
    }
    for (const product of Object.values(products)) {
      for (const inputRecipeId of product.recipes.input) {
        const recipe = recipes.get(inputRecipeId);
        expect(recipe, `Recipe ${inputRecipeId} not found for product ${product.id}`).toBeDefined();
        expect(recipe?.inputs.some(i => i.id === product.id), `Product ${product.id} not found in inputs of recipe ${recipe?.id}`).toBe(true);
      }
      for (const outputRecipeId of product.recipes.output) {
        const recipe = recipes.get(outputRecipeId);
        expect(recipe, `Recipe ${outputRecipeId} not found for product ${product.id}`).toBeDefined();
        expect(recipe?.outputs.some(o => o.id === product.id), `Product ${product.id} not found in outputs of recipe ${recipe?.id}`).toBe(true);
      }
    }
  });

  test("All recipe inputs and outputs should have valid number quantities", async () => {
    const { recipes } = allData;
    for (const recipe of recipes.values()) {
      const isBreeder0x = recipe.id === "FastBreederReactorEnrichment1" as RecipeId;
      for (const input of recipe.inputs) {
        const isBlanketOrEnriched = ["Product_BlanketFuel", "Product_BlanketFuelEnriched"].includes(input.id);
        if (isBreeder0x && isBlanketOrEnriched) continue; // There's always an exception to the rule...
          expect(input.quantity, `Input ${input.id} in recipe ${recipe.id} has invalid quantity`).toBeGreaterThan(0);
      }
      for (const output of recipe.outputs) {
        const isBlanketOrEnriched = ["Product_BlanketFuel", "Product_BlanketFuelEnriched"].includes(output.id);

        if (isBreeder0x && isBlanketOrEnriched) continue; // There's always an exception to the rule...
        expect(output.quantity, `Output ${output.id} in recipe ${recipe.id} has invalid quantity`).toBeGreaterThan(0);
      }
    }
  });

});

describe("Check parsed data", () => {
  let loadedData: ReturnType<typeof parseData>;
  beforeAll(async () => {
    const allData = await getDataFromRaw();
    loadedData = parseData({
      products: Object.fromEntries(allData.products),
      machines: Object.fromEntries(allData.machines),
      recipes: Object.fromEntries(allData.recipes),
    } as GameData);
  });

  test("All products should be linked to their recipes", () => {
    const recipes = loadedData.recipes;

    for (const [recipeId, recipe] of recipes) {
      for (const input of recipe.inputs) {
        expect(input.product).toBeDefined();
        expect(input.product.recipes.input.find(r => r.id === recipeId)).toBeDefined();
      }
      for (const output of recipe.outputs) {
        expect(output.product).toBeDefined();
        expect(output.product.recipes.output.find(r => r.id === recipeId)).toBeDefined();
      }
    }
  });


  test("Research and Maintenance recipes should be collapsed and have optional recyclable outputs", async () => {
    const { machines } = loadedData;
    for (const id of ["ResearchLab2", "ResearchLab3", "ResearchLab4", "ResearchLab5"]) {
      const machine = machines.get(id)!;
      expect(machine).toBeDefined();
      expect(machine.recipes.length).toBe(1);
      const item = machine.recipes[0].outputs.find(o => o.product.id === "Product_Recyclables" as ProductId);
      expect(item?.optional).toBe(true);
    }

    // All maintenance machines should have exactly one maintenance recipe with optional recyclables
    for (const id of ["MaintenanceDepotT1", "MaintenanceDepotT2", "MaintenanceDepotT3"]) {
      const machine = machines.get(id)!;
      expect(machine).toBeDefined();
      expect(machine.recipes.length).toBe(1);
      expect(machine.recipes[0].outputs.find(o => o.product.id === "Product_Recyclables" as ProductId && o.optional)).toBeDefined();
    }
  });

  test("Find Recyclables", () => {
    const { recipes } = loadedData;
    const recyclables = [];
    recipes.forEach((recipe) => {
      if (recipe.outputs.find(o => o.product.id === "Product_Recyclables" as ProductId && o.optional)) {
        console.log(`Recyclables found in recipe ${recipe.id} (${recipe.name})`);
        recyclables.push(recipe);
      }
    });
  });

  test("All machines with a footprint should have valid footprint dimensions", () => {
    const { machines } = loadedData;
    for (const machine of machines.values()) {
      if (machine.footprint) {
        if (machine.id.startsWith("Balancer")) continue; // Balancers have no footprint
        expect(machine.footprint[0], `Machine ${machine.id} has invalid footprint width`).toBeGreaterThan(0);
        expect(machine.footprint[1], `Machine ${machine.id} has invalid footprint height`).toBeGreaterThan(0);
        expect(machine.footprint[0], `Machine ${machine.id} has invalid footprint width`).toBeLessThanOrEqual(80);
        expect(machine.footprint[1], `Machine ${machine.id} has invalid footprint height`).toBeLessThanOrEqual(80);
      }
    } 
  });
});
