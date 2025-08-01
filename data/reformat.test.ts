import { initialMachineAndRecipeData, initialProductData } from "./reformat";

import { describe, expect, test } from 'vitest';

describe("Reformat", () => {
  test("Load product data", async () => {
    const products = await initialProductData();
    expect(products).toBeDefined();
    console.log("Products loaded:", products.size);
    expect(products.size).toBeGreaterThan(0);
    expect(products.get("Maintenance II")).toBeDefined();
    expect(products.get("Maintenance II")?.name).toBe("Maintenance II");
    expect(products.get("Maintenance II")?.icon).toBe("maintenance2.png");
  });

  test("Load machine & recipe data", async () => {
    const { machines } = await initialMachineAndRecipeData();
    const assembler2 = machines.get("AssemblyRoboticT1");
    expect(assembler2).toBeDefined();
    expect(assembler2?.name).toBe("Assembly IV");
    expect(assembler2?.workers).toBe(2);
    expect(assembler2?.maintenance_cost?.id).toBe("Product_Virtual_MaintenanceT2");
    expect(assembler2?.maintenance_cost?.quantity).toBe(4);
  });
  //   [ 134, 134, 134 ],
  // [ 58, 123, 58 ],

  test("All recipes with a link ID should have the same input and output products", async ()=>{
    const { recipes } = await initialMachineAndRecipeData();
    const linkIdMap = new Map<string, {inputs: Set<string>, outputs: Set<string>}>();

    for (const recipe of recipes.values()) {
      if (recipe.linkId) {
        if (!linkIdMap.has(recipe.linkId)) {
          linkIdMap.set(recipe.linkId, {
            inputs: new Set(recipe.inputs.map(i => i.id)),
            outputs: new Set(recipe.outputs.map(o => o.id)),
          });
        } else {
          const { inputs, outputs } = linkIdMap.get(recipe.linkId)!;
          expect(new Set(recipe.inputs.map(i => i.id)), `checking inputs for ${recipe.id}`).toEqual(inputs);
          expect(new Set(recipe.outputs.map(o => o.id)),`checking outputs for ${recipe.id}`).toEqual(outputs);
        }
      }
    }
    expect(linkIdMap.size).toBeLessThan(recipes.size);
  })

  test("All products should have their relevant recipes in their array", async () => {
    const { recipes, products } = await initialMachineAndRecipeData();
    for (const recipe of recipes.values()) {
      for (const input of recipe.inputs) {
        const product = products[input.id];
        expect(product, `Product ${input.id} not found for recipe ${recipe.id}`).toBeDefined();
        expect(product?.recipes.input.includes(recipe.id), `Recipe ${recipe.id} not found in input recipes for product ${input.id}`).toBe(true);
      }
      for (const output of recipe.outputs) {
        const product = products[output.id];
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
    const { recipes } = await initialMachineAndRecipeData();
    for (const recipe of recipes.values()) {
      for (const input of recipe.inputs) {
        expect(input.quantity, `Input ${input.id} in recipe ${recipe.id} has invalid quantity`).toBeGreaterThan(0);
      }
      for (const output of recipe.outputs) {
        expect(output.quantity, `Output ${output.id} in recipe ${recipe.id} has invalid quantity`).toBeGreaterThan(0);
      }
    }
  });
});
