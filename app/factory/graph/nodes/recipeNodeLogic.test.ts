/**
 * Unit tests for recipeNodeLogic pure functions
 */
import { describe, expect, it } from 'vitest';
import Big from 'big.js';
import { ProductId, type Recipe } from '../loadJsonData';
import { getQuantityDisplay, SettlementCalculator, ThermalStorageCalculator } from './recipeNodeLogic';
import {
  recyclablesForProduct,
  totalRecyclablesOutput,
  materialSplitForProduct,
  recyclablesProductId,
  recyclablesSourceMaterialSplit,
} from '../recyclables';
import { DEFAULT_ZONE_MODIFIERS } from '~/context/zoneModifiers';

function makeRecipe(params: {
  inputs: Array<{ id: string; quantity: number }>;
  outputs: Array<{ id: string; quantity: number; isScrap?: boolean; name?: string }>;
}): Recipe {
  return {
    inputs: params.inputs.map(input => ({
      product: { id: ProductId(input.id) },
      quantity: input.quantity,
    })),
    outputs: params.outputs.map(output => ({
      product: { id: ProductId(output.id), isScrap: output.isScrap, name: output.name },
      quantity: output.quantity,
    })),
  } as Recipe;
}

describe('recipeNodeLogic', () => {
  describe('getQuantityDisplay', () => {
    it('calculates product quantity with run count', () => {
      const result = getQuantityDisplay(10, 2, 't/month');
      expect(result).toBe('20 t/month');
    });

    it('handles decimal run counts', () => {
      const result = getQuantityDisplay(10, 2.5, 't/month');
      expect(result).toBe('25 t/month');
    });

    it('handles zero quantity', () => {
      const result = getQuantityDisplay(0, 5, 'kW');
      expect(result).toBe('0 kW');
    });

    it('handles zero run count', () => {
      const result = getQuantityDisplay(10, 0, 't/month');
      expect(result).toBe('0 t/month');
    });
  });

  describe('SettlementCalculator', () => {
    it('scales food inputs by enabled categories and items per category', () => {
      const recipe = makeRecipe({
        inputs: [
          { id: 'Product_Potato', quantity: 6 },
          { id: 'Product_Bread', quantity: 3 },
          { id: 'Product_Meat', quantity: 4 },
        ],
        outputs: [],
      });

      const calculator = SettlementCalculator(recipe, {
        inputs: {
          [ProductId('Product_Potato')]: true,
          [ProductId('Product_Bread')]: true,
          [ProductId('Product_Meat')]: true,
        },
        outputs: {},
      }, 2, DEFAULT_ZONE_MODIFIERS);

      expect(calculator.productInput(ProductId('Product_Potato'))).toBeCloseTo(3);
      expect(calculator.productInput(ProductId('Product_Bread'))).toBeCloseTo(1.5);
      expect(calculator.productInput(ProductId('Product_Meat'))).toBeCloseTo(4);
    });

    it('zeros water input when wastewater output is disabled', () => {
      const recipe = makeRecipe({
        inputs: [{ id: 'Product_Water', quantity: 10 }],
        outputs: [{ id: 'Product_WasteWater', quantity: 8 }],
      });

      const calculator = SettlementCalculator(recipe, {
        inputs: {
          [ProductId('Product_Water')]: true,
        },
        outputs: {
          [ProductId('Product_WasteWater')]: false,
        },
      }, 1, DEFAULT_ZONE_MODIFIERS);

      expect(calculator.productInput(ProductId('Product_Water'))).toBe(0);
      expect(calculator.productOutput(ProductId('Product_WasteWater'))).toBe(0);
    });

    it('zeros wastewater output when water input is disabled', () => {
      const recipe = makeRecipe({
        inputs: [{ id: 'Product_Water', quantity: 10 }],
        outputs: [{ id: 'Product_WasteWater', quantity: 8 }],
      });

      const calculator = SettlementCalculator(recipe, {
        inputs: {
          [ProductId('Product_Water')]: false,
        },
        outputs: {
          [ProductId('Product_WasteWater')]: true,
        },
      }, 1, DEFAULT_ZONE_MODIFIERS);

      expect(calculator.productInput(ProductId('Product_Water'))).toBe(0);
      expect(calculator.productOutput(ProductId('Product_WasteWater'))).toBe(0);
    });

    it('adds recyclables from enabled settlement commodity inputs', () => {
      const recipe = makeRecipe({
        inputs: [
          { id: 'Product_ConsumerElectronics', quantity: 30 },
          { id: 'Product_HouseholdGoods', quantity: 3 },
          { id: 'Product_HouseholdAppliances', quantity: 4 },
        ],
        outputs: [{ id: 'Product_Recyclables', quantity: 1 }],
      });

      const calculator = SettlementCalculator(recipe, {
        inputs: {
          [ProductId('Product_ConsumerElectronics')]: true,
          [ProductId('Product_HouseholdGoods')]: true,
          [ProductId('Product_HouseholdAppliances')]: true,
        },
        outputs: {
          [ProductId('Product_Recyclables')]: true,
        },
      }, 1, DEFAULT_ZONE_MODIFIERS);

      expect(calculator.productOutput(ProductId('Product_Recyclables'))).toBeCloseTo(57.75, 4);
    });

    it('does not add disabled commodity inputs to recyclables', () => {
      const recipe = makeRecipe({
        inputs: [
          { id: 'Product_ConsumerElectronics', quantity: 30 },
          { id: 'Product_HouseholdGoods', quantity: 3 },
          { id: 'Product_HouseholdAppliances', quantity: 4 },
        ],
        outputs: [{ id: 'Product_Recyclables', quantity: 1 }],
      });

      const calculator = SettlementCalculator(recipe, {
        inputs: {
          [ProductId('Product_ConsumerElectronics')]: true,
          [ProductId('Product_HouseholdGoods')]: false,
          [ProductId('Product_HouseholdAppliances')]: false,
        },
        outputs: {
          [ProductId('Product_Recyclables')]: true,
        },
      }, 1, DEFAULT_ZONE_MODIFIERS);

      expect(calculator.productOutput(ProductId('Product_Recyclables'))).toBeCloseTo(51, 4);
    });

    it('computes per-material scrap breakdown from enabled inputs', () => {
      const recipe = makeRecipe({
        inputs: [
          { id: 'Product_ConsumerElectronics', quantity: 30 },
          { id: 'Product_HouseholdGoods', quantity: 3 },
          { id: 'Product_HouseholdAppliances', quantity: 4 },
        ],
        outputs: [
          { id: 'Product_Recyclables', quantity: 0 },
          { id: 'Product_CopperScrap', quantity: 0, isScrap: true, name: 'Copper scrap' },
          { id: 'Product_GoldScrap', quantity: 0, isScrap: true, name: 'Gold scrap' },
          { id: 'Product_AluminumScrap', quantity: 0, isScrap: true, name: 'Aluminum scrap' },
          { id: 'Product_BrokenGlass', quantity: 0, isScrap: true, name: 'Broken glass' },
          { id: 'Product_IronScrap', quantity: 0, isScrap: true, name: 'Iron scrap' },
        ],
      });

      const calculator = SettlementCalculator(recipe, {
        inputs: {
          [ProductId('Product_ConsumerElectronics')]: true,
          [ProductId('Product_HouseholdGoods')]: true,
          [ProductId('Product_HouseholdAppliances')]: true,
        },
        outputs: {
          [ProductId('Product_Recyclables')]: true,
          [ProductId('Product_CopperScrap')]: true,
          [ProductId('Product_GoldScrap')]: true,
          [ProductId('Product_AluminumScrap')]: true,
          [ProductId('Product_BrokenGlass')]: true,
          [ProductId('Product_IronScrap')]: true,
        },
      }, 1, DEFAULT_ZONE_MODIFIERS);

      // Copper: ConsumerElectronics(30 * ~1.033) + HouseholdAppliances(4 * 0.85) = ~34.4
      expect(calculator.productOutput(ProductId('Product_CopperScrap'))).toBeGreaterThan(0);
      // Iron: HouseholdGoods(3 * 0.15) + HouseholdAppliances(4 * 0.4) = 2.05
      expect(calculator.productOutput(ProductId('Product_IronScrap'))).toBeGreaterThan(0);
      // Glass: multiple sources
      expect(calculator.productOutput(ProductId('Product_BrokenGlass'))).toBeGreaterThan(0);
      // Gold: ConsumerElectronics only
      expect(calculator.productOutput(ProductId('Product_GoldScrap'))).toBeGreaterThan(0);
      // Aluminium: ConsumerElectronics only
      expect(calculator.productOutput(ProductId('Product_AluminumScrap'))).toBeGreaterThan(0);
    });

    it('zeros scrap breakdown when commodity input is disabled', () => {
      const recipe = makeRecipe({
        inputs: [
          { id: 'Product_ConsumerElectronics', quantity: 30 },
        ],
        outputs: [
          { id: 'Product_Recyclables', quantity: 0 },
          { id: 'Product_CopperScrap', quantity: 0, isScrap: true, name: 'Copper scrap' },
          { id: 'Product_GoldScrap', quantity: 0, isScrap: true, name: 'Gold scrap' },
          { id: 'Product_AluminumScrap', quantity: 0, isScrap: true, name: 'Aluminum scrap' },
          { id: 'Product_BrokenGlass', quantity: 0, isScrap: true, name: 'Broken glass' },
        ],
      });

      const calculator = SettlementCalculator(recipe, {
        inputs: {
          [ProductId('Product_ConsumerElectronics')]: false,
        },
        outputs: {
          [ProductId('Product_Recyclables')]: true,
          [ProductId('Product_CopperScrap')]: true,
          [ProductId('Product_GoldScrap')]: true,
          [ProductId('Product_AluminumScrap')]: true,
          [ProductId('Product_BrokenGlass')]: true,
        },
      }, 1, DEFAULT_ZONE_MODIFIERS);

      expect(calculator.productOutput(ProductId('Product_CopperScrap'))).toBe(0);
      expect(calculator.productOutput(ProductId('Product_GoldScrap'))).toBe(0);
      expect(calculator.productOutput(ProductId('Product_AluminumScrap'))).toBe(0);
      expect(calculator.productOutput(ProductId('Product_BrokenGlass'))).toBe(0);
    });

    it('does not consume food when no food options are explicitly enabled', () => {
      const recipe = makeRecipe({
        inputs: [{ id: 'Product_Potato', quantity: 6 }],
        outputs: [],
      });

      const calculator = SettlementCalculator(recipe, {
        inputs: {},
        outputs: {},
      }, 1, DEFAULT_ZONE_MODIFIERS);

      expect(calculator.productInput(ProductId('Product_Potato'))).toBe(0);
    });
  });

  describe('ratio helpers', () => {
    it('sums total recyclables output across all input products', () => {
      const result = totalRecyclablesOutput({
        [ProductId('Product_ConsumerElectronics')]: Big(30),
        [ProductId('Product_HouseholdGoods')]: Big(3),
        [ProductId('Product_HouseholdAppliances')]: Big(4),
      });

      expect(result.toNumber()).toBeCloseTo(56.75, 8);
    });

    it('returns zero for products that do not contribute recyclables', () => {
      const result = totalRecyclablesOutput({
        [ProductId('Product_Water')]: Big(100),
      });

      expect(result.toNumber()).toBe(0);
    });

    it('calculates recyclables output for each individual source product', () => {
      const electronics = recyclablesForProduct(
        ProductId('Product_ConsumerElectronics'),
        Big(30),
      );
      const appliances = recyclablesForProduct(
        ProductId('Product_HouseholdAppliances'),
        Big(4),
      );
      const unsupported = recyclablesForProduct(
        ProductId('Product_Water'),
        Big(10),
      );

      expect(electronics.toNumber()).toBeCloseTo(50, 8);
      expect(appliances.toNumber()).toBeCloseTo(5.4, 8);
      expect(unsupported.toNumber()).toBe(0);
    });

    it('exposes recyclables source material split as configuration', () => {
      const electronicsSplit = recyclablesSourceMaterialSplit[ProductId('Product_ConsumerElectronics')];

      expect(electronicsSplit?.copper?.toNumber()).toBeCloseTo(1.0333333333, 8);
      expect(electronicsSplit?.gold?.toNumber()).toBeCloseTo(0.1333333333, 8);
      expect(electronicsSplit?.aluminium?.toNumber()).toBeCloseTo(0.3, 8);
      expect(electronicsSplit?.glass?.toNumber()).toBeCloseTo(0.2, 8);
    });

    it('calculates per-product material split at a given input rate', () => {
      const split = materialSplitForProduct(
        ProductId('Product_HouseholdAppliances'),
        Big(4),
      );

      expect(split.copper?.toNumber()).toBeCloseTo(3.4, 8);
      expect(split.glass?.toNumber()).toBeCloseTo(0.4, 8);
      expect(split.iron?.toNumber()).toBeCloseTo(1.6, 8);
    });

    it('defines recyclables source materials for known contributing products', () => {
      expect(Object.keys(recyclablesSourceMaterialSplit)).toEqual(expect.arrayContaining([
        ProductId('Product_ConsumerElectronics'),
        ProductId('Product_HouseholdGoods'),
        ProductId('Product_HouseholdAppliances'),
      ]));
    });

    it('exports recyclables as a first-class product id constant', () => {
      expect(recyclablesProductId).toBe(ProductId('Product_Recyclables'));
    });
  });

  describe('ThermalStorageCalculator', () => {
    const thermalRecipe = makeRecipe({
      inputs: [
        { id: 'Product_SteamLP', quantity: 1800 },
        { id: 'Product_Water', quantity: 1800 },
      ],
      outputs: [
        { id: 'Product_SteamLP', quantity: 1800 },
        { id: 'Product_Water', quantity: 1800 },
      ],
    });

    it('at 0% loss: full steam out, water in = steam out, water out = steam in', () => {
      const calc = ThermalStorageCalculator(thermalRecipe, { loss: 0 }, 1, DEFAULT_ZONE_MODIFIERS);
      expect(calc.productInput(ProductId('Product_SteamLP'))).toBe(1800);
      expect(calc.productInput(ProductId('Product_Water'))).toBe(1800);
      expect(calc.productOutput(ProductId('Product_SteamLP'))).toBe(1800);
      expect(calc.productOutput(ProductId('Product_Water'))).toBe(1800);
    });

    it('at 10% loss: 90% steam out, water in matches steam out, water out matches steam in', () => {
      const calc = ThermalStorageCalculator(thermalRecipe, { loss: 10 }, 1, DEFAULT_ZONE_MODIFIERS);
      expect(calc.productInput(ProductId('Product_SteamLP'))).toBe(1800);
      expect(calc.productInput(ProductId('Product_Water'))).toBe(1620);  // matches steam output
      expect(calc.productOutput(ProductId('Product_SteamLP'))).toBe(1620);
      expect(calc.productOutput(ProductId('Product_Water'))).toBe(1800); // matches steam input
    });

    it('at 50% loss: half steam out, water in = half steam, water out = full steam in', () => {
      const calc = ThermalStorageCalculator(thermalRecipe, { loss: 50 }, 1, DEFAULT_ZONE_MODIFIERS);
      expect(calc.productInput(ProductId('Product_SteamLP'))).toBe(1800);
      expect(calc.productInput(ProductId('Product_Water'))).toBe(900);   // matches steam output
      expect(calc.productOutput(ProductId('Product_SteamLP'))).toBe(900);
      expect(calc.productOutput(ProductId('Product_Water'))).toBe(1800); // matches steam input
    });

    it('at 100% loss: no steam out, no water in, water out = steam in', () => {
      const calc = ThermalStorageCalculator(thermalRecipe, { loss: 100 }, 1, DEFAULT_ZONE_MODIFIERS);
      expect(calc.productInput(ProductId('Product_SteamLP'))).toBe(1800);
      expect(calc.productInput(ProductId('Product_Water'))).toBe(0);
      expect(calc.productOutput(ProductId('Product_SteamLP'))).toBe(0);
      expect(calc.productOutput(ProductId('Product_Water'))).toBe(1800);
    });

    it('scales with runCount', () => {
      const calc = ThermalStorageCalculator(thermalRecipe, { loss: 10 }, 3, DEFAULT_ZONE_MODIFIERS);
      expect(calc.productInput(ProductId('Product_SteamLP'))).toBe(5400);
      expect(calc.productInput(ProductId('Product_Water'))).toBe(4860);
      expect(calc.productOutput(ProductId('Product_SteamLP'))).toBe(4860);
      expect(calc.productOutput(ProductId('Product_Water'))).toBe(5400);
    });

    it('zone modifiers do not affect thermal storage', () => {
      const modifiers = { ...DEFAULT_ZONE_MODIFIERS, maintenanceConsumption: 2, farmYield: 3 };
      const calc = ThermalStorageCalculator(thermalRecipe, { loss: 10 }, 1, modifiers);
      expect(calc.productInput(ProductId('Product_SteamLP'))).toBe(1800);
      expect(calc.productInput(ProductId('Product_Water'))).toBe(1620);
      expect(calc.productOutput(ProductId('Product_SteamLP'))).toBe(1620);
      expect(calc.productOutput(ProductId('Product_Water'))).toBe(1800);
    });

    it('defaults to 10% loss when loss is undefined', () => {
      const calc = ThermalStorageCalculator(thermalRecipe, { loss: undefined as unknown as number }, 1, DEFAULT_ZONE_MODIFIERS);
      expect(calc.productOutput(ProductId('Product_SteamLP'))).toBe(1620);
      expect(calc.productOutput(ProductId('Product_Water'))).toBe(1800);
    });

    it('returns 0 for unknown product input', () => {
      const calc = ThermalStorageCalculator(thermalRecipe, { loss: 10 }, 1, DEFAULT_ZONE_MODIFIERS);
      expect(calc.productInput(ProductId('Product_Unknown'))).toBe(0);
    });

    it('returns 0 for unknown product output', () => {
      const calc = ThermalStorageCalculator(thermalRecipe, { loss: 10 }, 1, DEFAULT_ZONE_MODIFIERS);
      expect(calc.productOutput(ProductId('Product_Unknown'))).toBe(0);
    });
  });

});
