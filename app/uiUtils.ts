import type { Machine } from "./factory/graph/loadJsonData";

let LANG = "en-GB";
if (typeof window !== "undefined")
  LANG = window.navigator.language;

export function formatNumber(value: number, unit: string): string {
  if (unit === "kW") {
    value /= 1000;
    unit = "MW";
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
