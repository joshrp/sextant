import React, { createContext, useContext, type ReactNode } from "react";

import useStore, { type FactoryStore } from "./store";

export type FactorySettings = {
  id: string; // Unique identifier for the factory
  name: string;
  icon?: string;
}

type FactoryContextType = {
  useStore: FactoryStore;
};

const FactoryContext = createContext<FactoryContextType | undefined>(undefined);

export const FactoryProvider = ({ children, id = "default-factory" }: { children: ReactNode, id: string }) => {
  console.log("FactoryProvider initialized for", id);

  // Init store with factory data
  const store = useStore({
    id: id,
    edges: [], 
    nodes: [], 
    goals: [],
  });

  return (
    <FactoryContext.Provider value={{ useStore: store }}>
      {children}
    </FactoryContext.Provider>
  );
};

export const useFactory = () => {
  const context = useContext(FactoryContext);
  if (!context) {
    throw new Error("useFactory must be used within a FactoryProvider");
  }
  return context;
};
