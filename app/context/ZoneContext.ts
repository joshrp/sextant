import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { MatrixStoreData, MatrixStore } from "./ZoneProvider";

type ProductionZoneContextType = {
  store: MatrixStore;
};

export const ProductionZoneContext = createContext<ProductionZoneContextType | undefined>(undefined);

export default function useProductionZone() {
  const context = useContext(ProductionZoneContext);
  if (!context) {
    throw new Error("useProductionZone must be used within a ProductionZoneProvider");
  }
  return context;
};

export function useProductionZoneStore<U>(selector: (state: MatrixStoreData) => U): U {
  return useStore(useProductionZone().store, selector);
}
