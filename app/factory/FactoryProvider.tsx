import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ProductId } from "./graph/loadJsonData";
var localStorage : any;
if (typeof window === 'undefined') {
  localStorage = {
    getItem: (a: string) => null,
    setItem: (a: string, b: any) => {},
    removeItem: (a: string) => {},
  };
} else {
  localStorage = window.localStorage;
}

export type FactorySettings = {
  id: string; // Unique identifier for the factory
  name: string;
  icon?: string;
  order: number;
  desiredOutputs: {
    id: ProductId,
    qty: number,
    priority: number,
  }[],
  fixedInputs: {
    id: ProductId,
    qty: number,
  }[],  
}

type ProductionMatrixSettings = {
  factories: {
    [id: string]: FactorySettings
  };
};

const DEFAULT_SETTINGS: ProductionMatrixSettings = {
  factories: {
    "default-factory": {
      id: "default-factory",
      name: "Default Factory",
      order: 0,
      desiredOutputs: [],
      fixedInputs: [],
    },
  },
};

type ProductionMatrixContextType = {
  settings: ProductionMatrixSettings;
  updateSettings: (updates: Partial<ProductionMatrixSettings>) => void;
  resetSettings: () => void;
};

const ProductionMatrixContext = createContext<ProductionMatrixContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "ProductionMatrix_settings";

export const ProductionMatrixProvider = ({ children }: { children: ReactNode }) => {
  console.log("ProductionMatrixProvider initialized");
  const [settings, setSettings] = useState<ProductionMatrixSettings>(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (updates: Partial<ProductionMatrixSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <ProductionMatrixContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </ProductionMatrixContext.Provider>
  );
};

export const useProductionMatrix = () => {
  const context = useContext(ProductionMatrixContext);
  if (!context) {
    throw new Error("useProductionMatrix must be used within a ProductionMatrixProvider");
  }
  return context;
};
