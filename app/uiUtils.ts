import type { Machine, Product, ProductId } from "./factory/graph/loadJsonData";
import type { IconInfo } from "./components/IconSelector";

let LANG = "en-GB";
if (typeof window !== "undefined")
  LANG = window.navigator.language;

export function unitAbbreviation(unit: string, value: number = 0): string {
  if (!isNaN(value) || !isFinite(value) || value === 0) {
    value = 0
  }
  if (unit === "kW") {
    if (Math.abs(value) >= 1000) {
      value /= 1000;
      unit = "MW";
    }
    if (Math.abs(value) >= 1000) {
      value /= 1000;
      unit = "GW";
    }
  }
  if (unit === "TFlops") {
    unit = "Tf";
    if (Math.abs(value) > 1000) {
      value = value / 1000;
      unit = "Pf";
    }
    if (Math.abs(value) > 1000) {
      value = value / 1000;
      unit = "Ef";
    }
  }
  return unit;
}

export function formatNumber(value: number, unit: string = '', maximumFractionDigits: number = 1): string {
  const unitstr = unitAbbreviation(unit, value);
  if (isNaN(value)) return "? " + unitstr;
  if (!isFinite(value)) return (value < 0 ? "-" : "") + "∞ " + unitstr;
  if (value === 0) return "0 " + unitstr;
  if (Math.abs(value) <= 0.001) return value.toExponential(1) + unitstr;


  return value.toLocaleString(LANG, { maximumFractionDigits }) + " " + unitstr;
}

export const productIcon = (icon: string) => `/assets/products/${icon}`;

export const machineIcon = (machine: Machine) => `/assets/buildings/${machine.id}.png`;
export const uiIcon = (icon: string) => `/assets/ui/${icon}.png`;
export const productBackground = (product: Product) => {
  return "hsl(from " + product.color + " h s calc(l*0.75))";
}

export const maintenanceIcon = (machine_or_product_id: Machine | ProductId) => {
  let productId = machine_or_product_id;
  if (typeof machine_or_product_id !== "string") {
    productId = machine_or_product_id.maintenance_cost?.id as ProductId;
  }
  switch (productId) {
    case "Product_Virtual_MaintenanceT1" as ProductId:
      return productIcon("maintenance1.png");
    case "Product_Virtual_MaintenanceT2" as ProductId:
      return productIcon("maintenance2.png");
    case "Product_Virtual_MaintenanceT3" as ProductId:
      return productIcon("maintenance3.png");
    default:
      return uiIcon("Maintenance");
  }
}

export const maintenanceName = (machine: Machine) => {
  switch (machine.maintenance_cost?.id) {
    case "Product_Virtual_MaintenanceT1" as ProductId:
      return "Maintenance 1";
    case "Product_Virtual_MaintenanceT2" as ProductId:
      return "Maintenance 2";
    case "Product_Virtual_MaintenanceT3" as ProductId:
      return "Maintenance 3";
    default:
      return "Maintenance";
  }
}

export const maintenanceKey = (machine: Machine) => {
  switch (machine.maintenance_cost?.id) {
    case "Product_Virtual_MaintenanceT1" as ProductId:
      return "maintenance_1";
    case "Product_Virtual_MaintenanceT2" as ProductId:
      return "maintenance_2";
    case "Product_Virtual_MaintenanceT3" as ProductId:
      return "maintenance_3";
    default:
      return "Maintenance";
  }
}

export function getAllIcons(products: Map<string, Product>, machines: Map<string, Machine>): IconInfo[] {
  const icons: IconInfo[] = [];

  // Add product icons
  products.forEach(product => {
    icons.push({
      path: productIcon(product.icon),
      name: product.name,
      category: 'product'
    });
  });

  // Add machine icons
  machines.forEach(machine => {
    icons.push({
      path: machineIcon(machine),
      name: machine.name,
      category: 'machine'
    });
  });

  // Add common UI icons
  const uiIcons = [
    'Worker', 'Workers', 'Electricity', 'Computing', 'Maintenance',
    'Build', 'Buildings', 'Cancel', 'Clock', 'Dumping',
    'Unity', 'Research', 'Settlement', 'Tree', 'Uranium'
  ];

  uiIcons.forEach(iconName => {
    icons.push({
      path: uiIcon(iconName),
      name: iconName,
      category: 'ui'
    });
  });

  return icons;
}
