import { createContext, useContext, type ReactNode } from "react";
import { LocalStorageProvider } from "./LocalStorageProvider";

type ProductionMatrixSettings = {
  factories: {
    id: string,
    order: number,
  }[]
};

const DEFAULT_SETTINGS: ProductionMatrixSettings = {
  factories: [{
    id: "default-factory",
    order: 0,
  }]
};

type ProductionMatrixContextType = LocalStorageProvider<ProductionMatrixSettings> & {

};

const ProductionMatrixContext = createContext<ProductionMatrixContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "ProductionMatrix_settings";

export const ProductionMatrixProvider = ({ children }: { children: ReactNode }) => {
  console.log("ProductionMatrixProvider initialized");

  const {settings, updateSettings, resetSettings} = LocalStorageProvider(LOCAL_STORAGE_KEY, DEFAULT_SETTINGS);

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
