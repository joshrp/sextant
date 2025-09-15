import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { MatrixStoreData, MatrixStore } from "./MatrixProvider";

type ProductionMatrixContextType = {
  store: MatrixStore;
};

export const ProductionMatrixContext = createContext<ProductionMatrixContextType | undefined>(undefined);

export default function useProductionMatrix() {
  const context = useContext(ProductionMatrixContext);
  if (!context) {
    throw new Error("useProductionMatrix must be used within a ProductionMatrixProvider");
  }
  return context;
};

export function useProductionMatrixStore<U>(selector: (state: MatrixStoreData) => U): U {
  return useStore(useProductionMatrix().store, selector);
}
