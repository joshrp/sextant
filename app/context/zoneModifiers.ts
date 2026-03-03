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
  contractProfitability: number;  // multiplier, default 1.0 (reserved, not yet used in calculations)
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
  contractProfitability: 1.0,
};

export type ModifierGroup =
  | 'recycling'
  | 'maintenance'
  | 'farming'
  | 'settlements'
  | 'energy'
  | 'contracts';

export interface ModifierMeta {
  label: string;
  tooltip: string;     // edict/research source description shown in ⓘ tooltip
  isAbsolute?: boolean; // true only for recyclingEfficiency
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
    isAbsolute: true,
    min: 0.01,
    max: 1,
    step: 0.05,
    default: 0.20,
    group: 'recycling',
  },
  maintenanceConsumption: {
    label: 'Maintenance Consumption',
    tooltip: 'Maintenance Cost adjustment',
    min: 0.01,
    max: 10,
    step: 0.05,
    default: 1.0,
    group: 'maintenance',
  },
  maintenanceOutput: {
    label: 'Maintenance Yield',
    tooltip: 'Maintenance output adjustment',
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
    group: 'farming',
  },
  foodConsumption: {
    label: 'Food Consumption',
    tooltip: 'Food consumption adjustment for settlements. Difficulty + Edicts + Research',
    min: 0.01,
    max: 10,
    step: 0.05,
    default: 1.0,
    group: 'settlements',
  },
  settlementWater: {
    label: 'Settlement Water',
    tooltip: 'Settlement water consumption adjustment',
    min: 0.01,
    max: 10,
    step: 0.05,
    default: 1.0,
    group: 'settlements',
  },
  householdGoods: {
    label: 'Household Goods',
    tooltip: 'Household goods settlement consumption adjustment',
    min: 0.01,
    max: 10,
    step: 0.05,
    default: 1.0,
    group: 'settlements',
  },
  householdAppliances: {
    label: 'Household Appliances',
    tooltip: 'Household appliances settlement consumption adjustment',
    min: 0.01,
    max: 10,
    step: 0.05,
    default: 1.0,
    group: 'settlements',
  },
  consumerElectronics: {
    label: 'Consumer Electronics',
    tooltip: 'Consumer Electronics Settlement consumption adjustment',
    min: 0.01,
    max: 10,
    step: 0.05,
    default: 1.0,
    group: 'settlements',
  },
  solarOutput: {
    label: 'Solar Output',
    tooltip: 'Solar panel output adjustment',
    min: 0.01,
    max: 10,
    step: 0.05,
    default: 1.0,
    group: 'energy',
  },
  contractProfitability: {
    label: 'Contract Profitability',
    tooltip: 'Not yet applied to calculations. Set this to model changes to contracts contract profitability in your game.',
    unbounded: true,
    step: 0.05,
    default: 1.0,
    group: 'contracts',
  },
};

/** Ordered list of groups for UI rendering */
export const MODIFIER_GROUP_ORDER: ModifierGroup[] = [
  'recycling',
  'maintenance',
  'farming',
  'settlements',
  'energy',
  'contracts',
];

export const MODIFIER_GROUP_LABELS: Record<ModifierGroup, string> = {
  recycling: 'Recycling',
  maintenance: 'Maintenance',
  farming: 'Farming',
  settlements: 'Settlements',
  energy: 'Energy',
  contracts: 'Contracts',
};
