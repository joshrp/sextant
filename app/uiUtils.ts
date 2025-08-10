import type { Machine, Product } from "./factory/graph/loadJsonData";

let LANG = "en-GB";
if (typeof window !== "undefined")
  LANG = window.navigator.language;

export function formatNumber(value: number, unit: string = ''): string {
  if (unit === "kW") {
    if (value >= 1000) {
      value /= 1000;
      unit = "MW";
    }
    if (value >= 1000) {
      value /= 1000;
      unit = "GW";
    }
  }
  if (unit === "TFlops") {
    if (value > 1000) {
      value = value / 1000;
      unit = "PFlops";
    }
    if (value > 1000) {
      value = value / 1000;
      unit = "EFlops";
    }
  }
  return value.toLocaleString(LANG, { maximumFractionDigits: 1 }) + " " + unit;
}

export const productIcon = (icon: string) => `/assets/products/${icon}`;

export const machineIcon = (machine: Machine) => `/assets/buildings/${machine.id}.png`;

export const productBackground = (product: Product) => {
  return "hsl(from " + product.color + " h s calc(l*0.75))";
}
