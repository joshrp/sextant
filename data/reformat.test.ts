import { parseData, ProductId, type GameData, type RecipeId } from "~/factory/graph/loadJsonData";
import { getDataFromRaw, writeRawData } from "./reformat";
import { recyclablesSourceMaterialSplit } from "~/factory/graph/recyclables";

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
      const isHousing = recipe.id.startsWith("Housing");
      for (const input of recipe.inputs) {
        const isBlanketOrEnriched = ["Product_BlanketFuel", "Product_BlanketFuelEnriched"].includes(input.id);
        if (isBreeder0x && isBlanketOrEnriched) continue; // There's always an exception to the rule...
        if (isHousing) continue; // Housing recipes have zero inputs
          expect(input.quantity, `Input ${input.id} in recipe ${recipe.id} has invalid quantity`).toBeGreaterThan(0);
      }
      for (const output of recipe.outputs) {
        const isBlanketOrEnriched = ["Product_BlanketFuel", "Product_BlanketFuelEnriched"].includes(output.id);

        if (isBreeder0x && isBlanketOrEnriched) continue; // There's always an exception to the rule...
        if (isHousing) continue; // Housing recipes have zero outputs
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

      const rpOutput = machine.recipes[0].outputs.find(
        o => o.product.id === ("Product_Virtual_ResearchPoints" as ProductId)
      );
      expect(rpOutput, `Recipe for ${id} should output Research Points`).toBeDefined();
      expect(rpOutput?.optional, `Research Points should not be optional for ${id}`).toBeFalsy();
    }

    // All maintenance machines should have exactly one maintenance recipe with optional recyclables
    for (const id of ["MaintenanceDepotT1", "MaintenanceDepotT2", "MaintenanceDepotT3"]) {
      const machine = machines.get(id)!;
      expect(machine).toBeDefined();
      expect(machine.recipes.length).toBe(1);
      expect(machine.recipes[0].outputs.find(o => o.product.id === "Product_Recyclables" as ProductId && o.optional)).toBeDefined();
    }
  });

  test("Research Points virtual product exists with correct properties", () => {
    const { products } = loadedData;
    const researchPoints = products.get(ProductId("Product_Virtual_ResearchPoints"));
    expect(researchPoints).toBeDefined();
    expect(researchPoints?.name).toBe("Research Points");
    expect(researchPoints?.icon).toBe("research.png");
    expect(researchPoints?.transport).toBe("Virtual");
    expect(researchPoints?.unit).toBe("pts");
  });

  test("All Research Labs produce Research Points at their research_speed rate", () => {
    const { machines } = loadedData;

    const expectedRates: Record<string, number> = {
      ResearchLab1: 3,
      ResearchLab2: 6,
      ResearchLab3: 12,
      ResearchLab4: 24,
      ResearchLab5: 48,
    };

    for (const [machineId, expectedRate] of Object.entries(expectedRates)) {
      const machine = machines.get(machineId)!;
      expect(machine, `Machine ${machineId} should exist`).toBeDefined();
      expect(machine.recipes.length, `Machine ${machineId} should have exactly 1 recipe`).toBe(1);

      const recipe = machine.recipes[0];
      const rpOutput = recipe.outputs.find(
        o => o.product.id === ("Product_Virtual_ResearchPoints" as ProductId)
      );
      expect(rpOutput, `Recipe ${recipe.id} should output Research Points`).toBeDefined();
      expect(rpOutput?.quantity, `Research Points rate for ${machineId}`).toBe(expectedRate);
      expect(rpOutput?.optional, `Research Points should NOT be optional for ${machineId}`).toBeFalsy();
    }
  });

  test("ResearchLab1 has a synthetic recipe with no inputs", () => {
    const { machines } = loadedData;
    const lab1 = machines.get("ResearchLab1")!;
    expect(lab1).toBeDefined();
    expect(lab1.recipes.length).toBe(1);
    expect(lab1.recipes[0].inputs.length).toBe(0);
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

  test("Recipes with non-zero Recyclables output should have material breakdown outputs", () => {
    const { recipes } = loadedData;
    const scrapProductIds = new Set([
      "Product_IronScrap", "Product_CopperScrap", "Product_GoldScrap",
      "Product_AluminumScrap", "Product_BrokenGlass",
    ]);

    recipes.forEach((recipe) => {
      const recyclablesOut = recipe.outputs.find(o => o.product.id === "Product_Recyclables" as ProductId);
      if (!recyclablesOut || recyclablesOut.quantity === 0) return;

      // Only expect breakdown outputs if at least one input has a known material split
      const inputsWithBreakdown = recipe.inputs.filter(i => recyclablesSourceMaterialSplit[i.product.id]);
      if (inputsWithBreakdown.length === 0) return;

      // Every such recipe must have at least one scrap output
      const breakdownOutputs = recipe.outputs.filter(o => o.product.isScrap && scrapProductIds.has(o.product.id));
      expect(
        breakdownOutputs.length,
        `Recipe ${recipe.id} (${recipe.name}) has inputs with known breakdown but no material breakdown outputs`
      ).toBeGreaterThan(0);

      // All breakdown outputs should have isScrap on their product and be known scrap products with positive quantities
      for (const output of breakdownOutputs) {
        expect(output.product.isScrap, `Product ${output.product.id} should be marked isScrap`).toBe(true);
        expect(
          scrapProductIds.has(output.product.id),
          `Unexpected scrap product ${output.product.id} in ${recipe.id}`
        ).toBe(true);
        expect(output.quantity, `Breakdown output ${output.product.id} in ${recipe.id} should have positive quantity`).toBeGreaterThan(0);
      }
    });
  });

  test("Settlement recipes should have material breakdown outputs for recyclables", () => {
    const { recipes } = loadedData;
    const scrapProductIds = new Set([
      "Product_IronScrap", "Product_CopperScrap", "Product_GoldScrap",
      "Product_AluminumScrap", "Product_BrokenGlass",
    ]);

    recipes.forEach((recipe) => {
      if (recipe.type !== "settlement") return;
      const recyclablesOut = recipe.outputs.find(o => o.product.id === "Product_Recyclables" as ProductId);
      if (!recyclablesOut) return;

      // Settlements should have scrap breakdown outputs if any input has a known material split
      const inputsWithBreakdown = recipe.inputs.filter(i => recyclablesSourceMaterialSplit[i.product.id]);
      if (inputsWithBreakdown.length === 0) return;

      const breakdownOutputs = recipe.outputs.filter(o => o.product.isScrap && scrapProductIds.has(o.product.id));
      expect(
        breakdownOutputs.length,
        `Settlement recipe ${recipe.id} (${recipe.name}) should have material breakdown outputs`
      ).toBeGreaterThan(0);

      for (const output of breakdownOutputs) {
        expect(output.product.isScrap, `Product ${output.product.id} should be marked isScrap`).toBe(true);
        expect(output.quantity, `Breakdown output ${output.product.id} in ${recipe.id} should have positive quantity`).toBeGreaterThan(0);
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

  test("Power generators have electricity_generated > 0", () => {
    const { machines } = loadedData;
    const powerGen = machines.get("PowerGeneratorT1");
    expect(powerGen).toBeDefined();
    expect(powerGen?.electricity_generated).toBe(2000);
    expect(powerGen?.electricity_consumed).toBe(0);
    
    // Check other power generators exist
    const powerGenT2 = machines.get("PowerGeneratorT2");
    expect(powerGenT2).toBeDefined();
    expect(powerGenT2?.electricity_generated).toBeGreaterThan(0);
  });

  test("Server rack has computing_generated > 0", () => {
    const { machines } = loadedData;
    const serverRack = machines.get("BasicServerRack");
    expect(serverRack).toBeDefined();
    expect(serverRack?.computing_generated).toBe(4);
    expect(serverRack?.computing_consumed).toBe(0);
    expect(serverRack?.electricity_consumed).toBe(85);
  });

  test("All machines have generation fields defined", () => {
    const { machines } = loadedData;
    for (const machine of machines.values()) {
      expect(machine.electricity_generated).toBeDefined();
      expect(machine.computing_generated).toBeDefined();
      expect(machine.electricity_consumed).toBeDefined();
      expect(machine.computing_consumed).toBeDefined();
      
      // Verify they are numbers (not undefined or null)
      expect(typeof machine.electricity_generated).toBe('number');
      expect(typeof machine.computing_generated).toBe('number');
      expect(typeof machine.electricity_consumed).toBe('number');
      expect(typeof machine.computing_consumed).toBe('number');
    }
  });
});
