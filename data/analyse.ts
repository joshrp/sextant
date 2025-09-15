#!/usr/bin/env ts-node

import { writeFileSync } from "fs";
import { loadData, type ProductId, type Recipe } from "../app/factory/graph/loadJsonData";


const { products } = loadData();

const terminalProducts = [
  "Product_Gold",
  "Product_Steel",
  "Product_TitaniumAlloy",
  "Product_Plastic",
  "Product_Glass",
  "Product_PolySilicon",
  "Product_ConcreteSlab",
  "Product_Rubber",
  "Product_Copper",
  "Product_Iron",
  "Product_Wood",
  "Product_Water",
  "Product_Sulfur",
  "Product_Limestone",
  "Product_Rock",
  "Product_Ethanol",
  "Product_Ammonia",
  "Product_Diesel",
  "Product_Coal",
  "Product_Sugar",
  "Product_HydrogenFluoride",
  "Product_FoodPack",
  "Product_Slag",
  "Product_FuelGas",
  "Product_Aluminum",
  "Product_CrudeOil",
  "Product_LightOil",
  "Product_HeavyOil",
  "Product_Oxygen",
  "Product_Nitrogen",
  "Product_Hydrogen",
] as const;
type TerminalProductId = typeof terminalProducts[number];

const ignoreRecipes = [
  "MechPartsAssemblyT5Iron"
];

function isTerminalProduct(id: TerminalProductId | string): id is TerminalProductId {
  return terminalProducts.includes(id as TerminalProductId);
}

type Analysis = {
  productId: string;
  productName: string;
  recipeChain: string[];
  choices: {
    productId: string;
    recipes: string[];
  }[];
  inputs: Partial<{ [K in TerminalProductId]: number }>;
  outputs: Partial<{ [K in ProductId]: number }>;
  routes: number;
};

let DEBUG_LOG = false;
const debug = (...args: unknown[]) => {
  if (DEBUG_LOG) 
    console.log(...args);
}

const productsSeen = new Map<string, Analysis>();
let depth = 0;
function analyseProduct(productId: ProductId): Analysis {
  if (productsSeen.has(productId)) {
    debug(" ".repeat(depth * 2), "Already seen", productId);
    return productsSeen.get(productId)!;
  }
  debug(" ".repeat(depth * 2), "Analysing", productId);
  productsSeen.set(productId, {
    productId,
    productName: products.get(productId)?.name || "Unknown",
    routes: -1,
    recipeChain: [],
    inputs: {},
    outputs: {},
    choices: [],
  });
  
  const product = products.get(productId as ProductId);
  if (!product) throw new Error("Product not found: " + productId);

  // Find all recipes that produce this product (that aren't just balancers)
  // filtering to only unique tierLink values
  const seenTierLinks = new Set<string | undefined>();
  const uniquieProducingRecipes = product.recipes.output.filter(r => {
    if (r.machine.id.startsWith("Balancer")) return false;
    if (r.id.includes("Scrap")) return false; // Ignore scrap recipes
    if (r.tiersLink) {
      if (seenTierLinks.has(r.tiersLink)) return false;
      seenTierLinks.add(r.tiersLink);
    }
    return true;
  });

  // Filter out any recipe that has a better version with the same inputs and outputs
  const producingRecipes = uniquieProducingRecipes.filter((r) => {
    if (ignoreRecipes.includes(r.id)) return false;
    for (const other of uniquieProducingRecipes) {
      if (r.id === other.id) continue;
      if (isImprovedRecipe(other, r)) {
        debug(" ".repeat(depth * 2), `Filtering out recipe ${r.id} in favor of improved ${other.id}`);
        return false;
      }
    }
    return true;
  });

  let result: Analysis;

  if (producingRecipes.length <= 0) {
    result = {
      productId,
      productName: product.name,
      routes: 0,
      recipeChain: [],
      inputs: {},
      outputs: {},
      choices: [],
    };
    productsSeen.set(productId, result);
    debug(" ".repeat(depth * 2), "No producing recipes for", productId);
  }

  if (producingRecipes.length > 1) {
    // Multiple recipes produce this product, we can't follow down
    result = {
      productId,
      productName: product.name,
      routes: producingRecipes.length,
      choices: [{
        productId,
        recipes: producingRecipes.map(r => r.id),
      }],
      recipeChain: [],
      inputs: { [productId]: 1 },
      outputs: {},
    };
    productsSeen.set(productId, result);
    debug(" ".repeat(depth * 2), "Multiple producing recipes for", productId);
  }

  if (producingRecipes.length === 1) {
    // Only one recipe produces this product, so we can follow it down
    const recipe = producingRecipes[0];
    result = {
      productId,
      productName: product.name,
      routes: 1,
      inputs: {},
      outputs: {},
      recipeChain: [recipe.id],
      choices: [],
    };
    
    let outputQuantity = 0;
    for (const output of recipe.outputs) {
      if (output.product.id === productId) 
        outputQuantity = output.quantity;
      else
        result.outputs[output.product.id] = output.quantity;
    }
    if (!outputQuantity) throw new Error("Recipe does not produce product: " + recipe.id + " -> " + productId);

    for (const input of recipe.inputs) {
      depth++;
      const recipeRatio = input.quantity / outputQuantity;
      const productDebug = `${input.product.id} ( x ${formatNumber(recipeRatio)})`;

      if (input.product.id === productId) {
        debug(" ".repeat(depth * 2), "Ignoring self-loop");
        depth--;
        continue; // Ignore self-loop inputs
      }
      
      if (isTerminalProduct(input.product.id)) {
        debug(" ".repeat(depth * 2), "Terminal Product -", productDebug);
        result.inputs[input.product.id as TerminalProductId] = (result.inputs[input.product.id as TerminalProductId] || 0) + recipeRatio;

      } else {
        debug(" ".repeat(depth * 2), "Input", productDebug);

        let subAnalysis = productsSeen.get(input.product.id)!;

        if (!subAnalysis) {        
          debug(" ".repeat(depth * 2), "Recursing into", productDebug);  
          depth++;
          subAnalysis = analyseProduct(input.product.id);
          depth--;
        }

        if(subAnalysis.routes === -1) {
          debug(" ".repeat(depth * 2), "Loop detected on", productDebug);
        } else {
          if (subAnalysis.routes === 0) {
            debug(" ".repeat(depth * 2), "Pseudo-terminal input", productDebug);
            // Sub-analysis has no producing recipes, so treat as terminal
            result.inputs[input.product.id as TerminalProductId] =  (result.inputs[input.product.id as TerminalProductId] || 0) + recipeRatio;
          } else {
            debug(" ".repeat(depth * 2), "Input", input.product.id, "is fully resolved with", Object.keys(subAnalysis.inputs).length, "inputs");
            for (const [k, v] of (Object.entries(subAnalysis.inputs) as [TerminalProductId, number][])) {
              (result.inputs[k] ||= 0)
              result.inputs[k] += v * recipeRatio;
            }
          }
          if (subAnalysis.choices.length > 0) {
            debug(" ".repeat(depth * 2), input.product.id, "has", subAnalysis.choices.length, "choices");
            // Sub-analysis has choices, so we can't fully resolve, merege together for debugging
            result.choices = result.choices.concat(subAnalysis.choices);
          }

          result.recipeChain.push(...subAnalysis.recipeChain);
        }
      }
      depth--;
    }

    productsSeen.set(productId, result);
  }

  if (result! === undefined) throw new Error("No result for product: " + productId);
  return result;
}

export function analyseAllProducts(): Analysis[] {
  const analyses: Analysis[] = [];
  for (const product of products.values()) {
    const analysis = analyseProduct(product.id);
    if (analysis)
      analyses.push(analysis);
  }
  writeFileSync("product-analyses.json", JSON.stringify(analyses, null, 2));
  return analyses;
}

// if a and b are recipes that produce the same product, using the same input, which one has the better ratio
const isImprovedRecipe = (a: Recipe, b: Recipe) => {
  if (a.outputs.length !== b.outputs.length) return false;
  if (a.inputs.length !== b.inputs.length) return false;
  

  a.outputs.sort((x, y) => x.product.id.localeCompare(y.product.id));
  b.outputs.sort((x, y) => x.product.id.localeCompare(y.product.id));
  a.inputs.sort((x, y) => x.product.id.localeCompare(y.product.id));
  b.inputs.sort((x, y) => x.product.id.localeCompare(y.product.id));

  for (let i = 0; i < a.outputs.length; i++) {
    if (a.outputs[i].product.id !== b.outputs[i].product.id) return false;
  }
  for (let i = 0; i < a.inputs.length; i++) {
    if (a.inputs[i].product.id !== b.inputs[i].product.id) return false;
  }
  
  // Now we know they have the same inputs and outputs, compare ratios of total input to output
  const aInput = a.inputs.reduce((sum, item) => sum + item.quantity, 0);
  const aOutput = a.outputs.reduce((sum, item) => sum + item.quantity, 0);
  const bInput = b.inputs.reduce((sum, item) => sum + item.quantity, 0);
  const bOutput = b.outputs.reduce((sum, item) => sum + item.quantity, 0);

  const aRatio = aOutput / aInput;
  const bRatio = bOutput / bInput;

  return aRatio > bRatio;
}

import commandLineArgs from 'command-line-args';
import { formatNumber } from "~/uiUtils";

// If run directly, output analysis to console
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = commandLineArgs([{
    name: 'debug', type: Boolean, defaultValue: true, alias: 'd'
  }, {
    name: 'product', type: String, alias: 'p'
  },{
    name: 'output', type: String, alias: 'o'
  }]);

  if (options.debug) {
    DEBUG_LOG = true;
  } 

  if (options.product) {
    if(!products.has(options.product as ProductId)) {
      console.error("Product not found", options.product); process.exit(1); 
    }

    console.log("Analysing product", options.product);
    const analysis = analyseProduct(options.product as ProductId);
    console.log(JSON.stringify(analysis, null, 2));
    process.exit(0);
  }
  console.log("Analysing all products...");
  const analyses = analyseAllProducts();
  const productChoices = new Map<string, Analysis>();
  for (const analysis of analyses) {
    if (analysis.recipeChain.length == 0  && analysis.choices.length > 0 && !terminalProducts.includes(analysis.productId as TerminalProductId)) {
      productChoices.set(analysis.productId, analysis);
    }
  }
  for (const analysis of productChoices.values().toArray().sort((a, b) => b.choices[0].recipes.length - a.choices[0].recipes.length)) {
    console.log(`${analysis.productName} has ${analysis.choices[0].recipes.length} choices`);

  }
  console.log(`Analysed ${analyses.length} products`);
  if (options.output)
    console.log(JSON.stringify(analyses, null, 2));
  else
    writeFileSync("product-analyses.json", JSON.stringify(analyses, null, 2));
}

