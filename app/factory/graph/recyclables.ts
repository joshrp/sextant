import Big from 'big.js';
import { ProductId } from './loadJsonData';

export const recyclablesProductId = ProductId('Product_Recyclables');

export type RecyclablesMaterial = 'copper' | 'gold' | 'aluminium' | 'glass' | 'iron';

export type RecyclablesMaterialSplit = Partial<Record<RecyclablesMaterial, Big>>;

/** Per-unit recyclable material breakdown for each product that contributes recyclables.
 * Values represent scrap output at 60% recycling efficiency (ver 0.7.5). */
export const recyclablesSourceMaterialSplit: Partial<Record<ProductId, RecyclablesMaterialSplit>> = {
  [ProductId('Product_Steel')]: {
    iron: Big('1.2'),
  },
  [ProductId('Product_MechanicalParts')]: {
    iron: Big('0.6'),
  },
  [ProductId('Product_PCB')]: {
    copper: Big('0.15'),
    glass: Big('0.3'),
  },
  [ProductId('Product_Microchips')]: {
    copper: Big('0.4'),
    gold: Big('0.4'),
  },
  [ProductId('Product_HouseholdGoods')]: {
    iron: Big('0.15'),
    glass: Big('0.3'),
  },
  [ProductId('Product_MedicalEquipment')]: {
    iron: Big('0.72'),
  },
  [ProductId('Product_Anesthetics')]: {
    iron: Big('0.15'),
  },
  [ProductId('Product_Morphine')]: {
    glass: Big('0.15'),
  },
  [ProductId('Product_Electronics')]: {
    copper: Big('0.6'),
  },
  [ProductId('Product_Electronics2')]: {
    copper: Big('1.35'),
    glass: Big('0.3'),
  },
  [ProductId('Product_Electronics3')]: {
    copper: Big('3.1'),
    gold: Big('0.4'),
    glass: Big('0.6'),
  },
  [ProductId('Product_LabEquipment')]: {
    iron: Big('0.4'),
    copper: Big('0.2'),
  },
  [ProductId('Product_LabEquipment2')]: {
    iron: Big('0.4'),
    copper: Big('0.2'),
    glass: Big('0.2'),
  },
  [ProductId('Product_LabEquipment3')]: {
    iron: Big('0.4'),
    copper: Big('0.425'),
    glass: Big('0.25'),
  },
  [ProductId('Product_LabEquipment4')]: {
    iron: Big('0.4'),
    copper: Big('0.8125'),
    gold: Big('0.05'),
    glass: Big('0.325'),
  },
  [ProductId('Product_OfficeSupplies')]: {
    iron: Big('0.05'),
    copper: Big('0.225'),
    glass: Big('0.15'),
  },
  [ProductId('Product_HouseholdAppliances')]: {
    iron: Big('0.4'),
    copper: Big('0.85'),
    glass: Big('0.1'),
  },
  [ProductId('Product_ConsumerElectronics')]: {
    copper: Big(1).div(30).plus(1),
    gold: Big(1).div(7.5),
    aluminium: Big('0.3'),
    glass: Big('0.2'),
  },
  [ProductId('Product_LuxuryGoods')]: {
    gold: Big('0.15'),
  },
  [ProductId('Product_MedicalSupplies')]: {
    iron: Big('0.36'),
  },
  [ProductId('Product_MedicalSupplies2')]: {
    iron: Big('0.36'),
  },
  [ProductId('Product_MedicalSupplies3')]: {
    iron: Big('0.435'),
    glass: Big('0.075'),
  },
};

/** Sum material quantities in a split */
const sumMaterials = (split: RecyclablesMaterialSplit): Big =>
  Object.values(split).reduce<Big>((total, v) => total.plus(v ?? 0), Big(0));

/** Total recyclables produced by one unit of a given input product */
const recyclablesPerUnit = (productId: ProductId): Big => {
  const materials = recyclablesSourceMaterialSplit[productId];
  if (!materials) return Big(0);
  return sumMaterials(materials);
};

/** Recyclables output from a single product at the given input rate */
export const recyclablesForProduct = (productId: ProductId, inputRate: Big): Big =>
  recyclablesPerUnit(productId).mul(inputRate);

/** Material breakdown of recyclables from a single product at the given input rate */
export const materialSplitForProduct = (
  productId: ProductId,
  inputRate: Big,
): RecyclablesMaterialSplit => {
  const materials = recyclablesSourceMaterialSplit[productId];
  if (!materials) return {};
  return Object.fromEntries(
    Object.entries(materials).map(([mat, qty]) => [mat, qty!.mul(inputRate)]),
  ) as RecyclablesMaterialSplit;
};

/**
 * Total recyclables output from all input products.
 * Sums the recycling contribution of each input product that generates recyclables.
 */
export const totalRecyclablesOutput = (
  inputs: Partial<Record<ProductId, Big>>,
): Big =>
  Object.entries(inputs).reduce<Big>(
    (total, [productId, rate]) =>
      rate ? total.plus(recyclablesForProduct(productId as ProductId, rate)) : total,
    Big(0),
  );
