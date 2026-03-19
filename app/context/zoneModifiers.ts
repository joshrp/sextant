/**
 * Zone modifier types, defaults, and metadata.
 * This is the single source of truth for all per-zone edict/research modifiers.
 * No imports from the rest of the app — safe to import anywhere.
 */

export interface ZoneModifiers {
  recyclingEfficiency: number;    // absolute rate, default 0.60 (stored as 0.0–0.75)
  maintenanceConsumption: number; // multiplier, default 1.0
  maintenanceOutput: number;      // multiplier, default 1.0
  farmYield: number;              // multiplier, default 1.0
  farmWater: number;              // multiplier, default 1.0
  foodConsumption: number;        // multiplier, default 1.0
  settlementWater: number;        // multiplier, default 1.0
  householdGoods: number;         // multiplier, default 1.0
  householdAppliances: number;    // multiplier, default 1.0
  consumerElectronics: number;    // multiplier, default 1.0
  solarOutput: number;            // multiplier, default 1.0
  rainwaterOutput: number;        // multiplier, default 1.0
  contractProfitability: number;  // multiplier, default 1.0, scales contract output quantities
}

export const DEFAULT_ZONE_MODIFIERS: ZoneModifiers = {
  recyclingEfficiency: 0.60,
  maintenanceConsumption: 1.0,
  maintenanceOutput: 1.0,
  farmYield: 1.0,
  farmWater: 1.0,
  foodConsumption: 1.0,
  settlementWater: 1.0,
  householdGoods: 1.0,
  householdAppliances: 1.0,
  consumerElectronics: 1.0,
  solarOutput: 1.0,
  rainwaterOutput: 1.0,
  contractProfitability: 1.0,
};

export type ModifierGroup =
  | 'recycling'
  | 'maintenance'
  | 'farming'
  | 'settlements'
  | 'infrastructure'
  | 'contracts';

export interface ModifierMeta {
  label: string;
  tooltip: string;     // edict/research source description shown in ⓘ tooltip
  isMultiplier?: boolean; // if true it's used a multiplier on recipes
  isAbsolute?: boolean; // if true it's used as an absolute value (e.g. rainwater harvester output in m³/s)
  unbounded?: boolean; // true only for contractProfitability; omits min/max
  min?: number;        // decimal (e.g. 0.5 = 50%); absent when unbounded
  max?: number;        // decimal (e.g. 4.0 = 400%); absent when unbounded
  step: number;        // decimal (e.g. 0.01 = 1%)
  default: number;     // decimal
  group: ModifierGroup;
}

export const MODIFIER_META: Record<keyof ZoneModifiers, ModifierMeta> = {
  recyclingEfficiency: {
    label: 'Recycling Efficiency',
    tooltip: 'Base 60%. Recycling Increase I–IV each add +20%, +15%, +10%, +10% (hard cap 75%).',
    min: 0.01,
    max: 1,
    step: 0.05,
    default: 0.60,
    group: 'recycling',
    isMultiplier: false,

  },
  maintenanceConsumption: {
    label: 'Maintenance Consumption',
    tooltip: 'Maintenance Cost adjustment',
    isMultiplier: true,
    min: 0.01,
    max: 10,
    step: 0.05,
    default: 1.0,
    group: 'maintenance',
  },
  maintenanceOutput: {
    label: 'Maintenance Yield',
    tooltip: 'Maintenance output adjustment',
    isMultiplier: true,
    min: 0.01,
    max: 10,
    step: 0.05,
    default: 1.0,
    group: 'maintenance',
  },
  farmYield: {
    label: 'Crop Yield',
    tooltip: 'Crop yield adjustment for farms',
    min: 0.01,
    isMultiplier: true,
    max: 10,
    step: 0.05,
    default: 1.0,
    group: 'farming',
  },
  farmWater: {
    label: 'Crop Water Use',
    tooltip: 'Water used by farms',
    min: 0.01,
    max: 10,
    step: 0.05,
    default: 1.0,
    isMultiplier: true,
    group: 'farming',
  },
  foodConsumption: {
    label: 'Food Consumption',
    tooltip: 'Food consumption adjustment for settlements. Difficulty + Edicts + Research',
    min: 0.01,
    max: 10,
    step: 0.05,
    default: 1.0,
    isMultiplier: true,
    group: 'settlements',
  },
  settlementWater: {
    label: 'Settlement Water',
    tooltip: 'Settlement water consumption adjustment',
    min: 0.01,
    max: 10,
    step: 0.05,
    default: 1.0,
    isMultiplier: true,
    group: 'settlements',
  },
  householdGoods: {
    label: 'Household Goods',
    tooltip: 'Household goods settlement consumption adjustment',
    min: 0.01,
    max: 10,
    step: 0.05,
    default: 1.0,
    isMultiplier: true,
    group: 'settlements',
  },
  householdAppliances: {
    label: 'Household Appliances',
    tooltip: 'Household appliances settlement consumption adjustment',
    min: 0.01,
    max: 10,
    step: 0.05,
    default: 1.0,
    isMultiplier: true,
    group: 'settlements',
  },
  consumerElectronics: {
    label: 'Consumer Electronics',
    tooltip: 'Consumer Electronics Settlement consumption adjustment',
    min: 0.01,
    max: 10,
    step: 0.05,
    default: 1.0,
    isMultiplier: true,
    group: 'settlements',
  },
  solarOutput: {
    label: 'Solar Output',
    tooltip: 'Solar panel output adjustment',
    min: 0.01,
    max: 10,
    step: 0.05,
    default: 1.0,
    isMultiplier: true,
    group: 'infrastructure',
  },
  rainwaterOutput: {
    label: 'Rainwater Harvester Output',
    tooltip: 'Absolute value of Rainwater harvester output',
    min: 0.1,
    max: 1000,
    step: 0.1,
    default: 4.1,
    group: 'infrastructure',
    isMultiplier: false,
    isAbsolute: true
  },
  contractProfitability: {
    label: 'Contract Profitability',
    tooltip: 'Scales contract output quantities. Increase to model higher trade profitability from edicts/research.',
    unbounded: true,
    step: 0.05,
    default: 1.0,
    isMultiplier: true,
    group: 'contracts',
  },
};

/** Ordered list of groups for UI rendering */
export const MODIFIER_GROUP_ORDER: ModifierGroup[] = [
  'recycling',
  'maintenance',
  'farming',
  'settlements',
  'infrastructure',
  'contracts',
];

export const MODIFIER_GROUP_LABELS: Record<ModifierGroup, string> = {
  recycling: 'Recycling',
  maintenance: 'Maintenance',
  farming: 'Farming',
  settlements: 'Settlements',
  infrastructure: 'Infrastructure',
  contracts: 'Contracts',
};
