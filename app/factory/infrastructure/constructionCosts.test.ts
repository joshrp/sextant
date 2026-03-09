/**
 * Unit tests for construction cost calculation utilities
 */
import { describe, expect, it, vi } from 'vitest';
import { calculateConstructionCosts } from './constructionCosts';
import type { CustomNodeType } from '../graph/nodes';
import type { Machine, Product, ProductId, RecipeId, Recipe, CategoryId } from '../graph/loadJsonData';

// Create a mock recipe node for the graph
function createRecipeNode(
  id: string,
  recipeId: string,
  runCount: number,
  solved = true,
): CustomNodeType {
  return {
    id,
    type: 'recipe-node',
    position: { x: 0, y: 0 },
    data: {
      type: 'recipe' as const,
      recipeId: recipeId as RecipeId,
      solution: solved ? { solved: true, runCount } : { solved: false },
    },
  } as CustomNodeType;
}

// We need to mock the loadData function to control recipe lookups
vi.mock('../graph/loadJsonData', async (importOriginal: () => Promise<typeof import('../graph/loadJsonData')>) => {
  const actual = await importOriginal();

  const cp2 = {
    id: 'Product_ConstructionParts2' as ProductId,
    name: 'Construction Parts II',
    icon: 'cp2.png',
    color: '#888',
    unit: '',
    transport: 'Flat' as const,
    recipes: { input: [], output: [] },
    machines: { input: [], output: [] },
  } as Product;

  const electronics = {
    id: 'Product_Electronics' as ProductId,
    name: 'Electronics',
    icon: 'electronics.png',
    color: '#44f',
    unit: '',
    transport: 'Flat' as const,
    recipes: { input: [], output: [] },
    machines: { input: [], output: [] },
  } as Product;

  const concrete = {
    id: 'Product_Concrete' as ProductId,
    name: 'Concrete',
    icon: 'concrete.png',
    color: '#aaa',
    unit: '',
    transport: 'Loose' as const,
    recipes: { input: [], output: [] },
    machines: { input: [], output: [] },
  } as Product;

  const furnaceMachine = {
    id: 'Machine_Furnace',
    name: 'Furnace',
    category_id: 'Cat_Smelting' as CategoryId,
    workers: 2,
    workers_generated: 0,
    electricity_consumed: 50,
    electricity_generated: 0,
    computing_consumed: 0,
    computing_generated: 0,
    storage_capacity: 0,
    unity_cost: 0,
    research_speed: 0,
    isFarm: false,
    recipes: [],
    icon: 'furnace.png',
    buildCosts: [
      { product: cp2, quantity: 10 },
      { product: electronics, quantity: 5 },
    ],
  } as unknown as Machine;

  const assemblyMachine = {
    id: 'Machine_Assembly',
    name: 'Assembly',
    category_id: 'Cat_Manufacturing' as CategoryId,
    workers: 3,
    workers_generated: 0,
    electricity_consumed: 80,
    electricity_generated: 0,
    computing_consumed: 0,
    computing_generated: 0,
    storage_capacity: 0,
    unity_cost: 0,
    research_speed: 0,
    isFarm: false,
    recipes: [],
    icon: 'assembly.png',
    buildCosts: [
      { product: cp2, quantity: 20 },
      { product: concrete, quantity: 10 },
    ],
  } as unknown as Machine;

  const noCostMachine = {
    id: 'Machine_NoCost',
    name: 'No Cost Machine',
    category_id: 'Cat_Other' as CategoryId,
    workers: 0,
    workers_generated: 0,
    electricity_consumed: 0,
    electricity_generated: 0,
    computing_consumed: 0,
    computing_generated: 0,
    storage_capacity: 0,
    unity_cost: 0,
    research_speed: 0,
    isFarm: false,
    recipes: [],
    icon: 'nocost.png',
    buildCosts: [],
  } as unknown as Machine;

  const recipes = new Map<string, Recipe>();
  recipes.set('FurnaceRecipe1', {
    id: 'FurnaceRecipe1' as RecipeId,
    name: 'Smelt Iron',
    machine: furnaceMachine,
    inputs: [],
    outputs: [],
    duration: 20,
    type: 'recipe',
  } as unknown as Recipe);

  recipes.set('FurnaceRecipe2', {
    id: 'FurnaceRecipe2' as RecipeId,
    name: 'Smelt Copper',
    machine: furnaceMachine,
    inputs: [],
    outputs: [],
    duration: 20,
    type: 'recipe',
  } as unknown as Recipe);

  recipes.set('AssemblyRecipe1', {
    id: 'AssemblyRecipe1' as RecipeId,
    name: 'Assemble Parts',
    machine: assemblyMachine,
    inputs: [],
    outputs: [],
    duration: 30,
    type: 'recipe',
  } as unknown as Recipe);

  recipes.set('NoCostRecipe', {
    id: 'NoCostRecipe' as RecipeId,
    name: 'Free Recipe',
    machine: noCostMachine,
    inputs: [],
    outputs: [],
    duration: 10,
    type: 'recipe',
  } as unknown as Recipe);

  const machines = new Map();
  machines.set(furnaceMachine.id, furnaceMachine);
  machines.set(assemblyMachine.id, assemblyMachine);
  machines.set(noCostMachine.id, noCostMachine);

  const products = new Map();
  products.set(cp2.id, cp2);
  products.set(electronics.id, electronics);
  products.set(concrete.id, concrete);

  return {
    ...actual,
    loadData: () => ({ recipes, machines, products }),
  };
});

describe('calculateConstructionCosts', () => {
  it('returns empty totals and machines for empty node list', () => {
    const result = calculateConstructionCosts([]);
    expect(result.totals).toEqual([]);
    expect(result.machines).toEqual([]);
  });

  it('calculates costs for a single machine type', () => {
    const nodes: CustomNodeType[] = [
      createRecipeNode('node1', 'FurnaceRecipe1', 3),
    ];

    const result = calculateConstructionCosts(nodes);

    // 3 runCount → ceil(3) = 3 buildings
    // 3 * 10 CP2 = 30, 3 * 5 Electronics = 15
    expect(result.totals).toHaveLength(2);
    expect(result.totals.find(t => t.product.name === 'Construction Parts II')?.quantity).toBe(30);
    expect(result.totals.find(t => t.product.name === 'Electronics')?.quantity).toBe(15);

    expect(result.machines).toHaveLength(1);
    expect(result.machines[0].machineId).toBe('Machine_Furnace');
    expect(result.machines[0].buildingCount).toBe(3);
  });

  it('aggregates costs across multiple nodes of the same machine', () => {
    const nodes: CustomNodeType[] = [
      createRecipeNode('node1', 'FurnaceRecipe1', 2),
      createRecipeNode('node2', 'FurnaceRecipe2', 1.5), // ceil(1.5) = 2
    ];

    const result = calculateConstructionCosts(nodes);

    // Furnace: 2 + 2 = 4 buildings
    // CP2: 4 * 10 = 40, Electronics: 4 * 5 = 20
    expect(result.machines).toHaveLength(1);
    expect(result.machines[0].buildingCount).toBe(4);
    expect(result.machines[0].costs.find(c => c.product.name === 'Construction Parts II')?.quantity).toBe(40);
    expect(result.machines[0].costs.find(c => c.product.name === 'Electronics')?.quantity).toBe(20);
  });

  it('aggregates costs across different machine types with overlapping products', () => {
    const nodes: CustomNodeType[] = [
      createRecipeNode('node1', 'FurnaceRecipe1', 2),
      createRecipeNode('node2', 'AssemblyRecipe1', 3),
    ];

    const result = calculateConstructionCosts(nodes);

    // Furnace: 2 buildings → 20 CP2, 10 Electronics
    // Assembly: 3 buildings → 60 CP2, 30 Concrete
    // Total CP2: 80, Electronics: 10, Concrete: 30
    expect(result.totals).toHaveLength(3);
    expect(result.totals.find(t => t.product.name === 'Construction Parts II')?.quantity).toBe(80);
    expect(result.totals.find(t => t.product.name === 'Electronics')?.quantity).toBe(10);
    expect(result.totals.find(t => t.product.name === 'Concrete')?.quantity).toBe(30);

    expect(result.machines).toHaveLength(2);
  });

  it('uses ceil of runCount for building count', () => {
    const nodes: CustomNodeType[] = [
      createRecipeNode('node1', 'FurnaceRecipe1', 0.3), // ceil(0.3) = 1
    ];

    const result = calculateConstructionCosts(nodes);

    expect(result.machines[0].buildingCount).toBe(1);
    expect(result.totals.find(t => t.product.name === 'Construction Parts II')?.quantity).toBe(10);
    expect(result.totals.find(t => t.product.name === 'Electronics')?.quantity).toBe(5);
  });

  it('defaults to runCount=1 when node is unsolved', () => {
    const nodes: CustomNodeType[] = [
      createRecipeNode('node1', 'FurnaceRecipe1', 0, false),
    ];

    const result = calculateConstructionCosts(nodes);

    // Unsolved → runCount defaults to 1 → 1 building
    expect(result.machines[0].buildingCount).toBe(1);
    expect(result.totals.find(t => t.product.name === 'Construction Parts II')?.quantity).toBe(10);
  });

  it('skips machines with no build costs', () => {
    const nodes: CustomNodeType[] = [
      createRecipeNode('node1', 'NoCostRecipe', 5),
    ];

    const result = calculateConstructionCosts(nodes);

    expect(result.totals).toHaveLength(0);
    expect(result.machines).toHaveLength(0);
  });

  it('skips annotation nodes', () => {
    const nodes: CustomNodeType[] = [
      {
        id: 'annotation1',
        type: 'annotation-node',
        position: { x: 0, y: 0 },
        data: { text: 'Hello' },
      } as unknown as CustomNodeType,
      createRecipeNode('node1', 'FurnaceRecipe1', 2),
    ];

    const result = calculateConstructionCosts(nodes);

    expect(result.machines).toHaveLength(1);
    expect(result.machines[0].machineId).toBe('Machine_Furnace');
  });

  it('sorts totals by quantity descending', () => {
    const nodes: CustomNodeType[] = [
      createRecipeNode('node1', 'FurnaceRecipe1', 2),
      createRecipeNode('node2', 'AssemblyRecipe1', 3),
    ];

    const result = calculateConstructionCosts(nodes);

    // CP2: 80, Concrete: 30, Electronics: 10
    expect(result.totals[0].product.name).toBe('Construction Parts II');
    expect(result.totals[1].product.name).toBe('Concrete');
    expect(result.totals[2].product.name).toBe('Electronics');
  });

  it('sorts machines by building count descending', () => {
    const nodes: CustomNodeType[] = [
      createRecipeNode('node1', 'FurnaceRecipe1', 1),
      createRecipeNode('node2', 'AssemblyRecipe1', 5),
    ];

    const result = calculateConstructionCosts(nodes);

    expect(result.machines[0].machineId).toBe('Machine_Assembly');
    expect(result.machines[0].buildingCount).toBe(5);
    expect(result.machines[1].machineId).toBe('Machine_Furnace');
    expect(result.machines[1].buildingCount).toBe(1);
  });
});
