import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ProductId } from "./graph/loadJsonData";
import { LocalStorageProvider } from "./LocalStorageProvider";

import { initialNodes, type CustomNodeType } from "./graph/nodes";
import { initialEdges, type CustomEdgeType } from "./graph/edges";
import useStore, { type FactoryStore } from "./store";

export type FactorySettings = {
  id: string; // Unique identifier for the factory
  name: string;
  icon?: string;
}

const DEFAULT_SETTINGS: FactorySettings = {
  id: "default-factory",
  name: "Default",
}

type FactoryContextType =  LocalStorageProvider<FactorySettings> & {
  useStore: FactoryStore;
};

const FactoryContext = createContext<FactoryContextType | undefined>(undefined);

const localstoragePrefix = "Factory_settings_" ;

export const FactoryProvider = ({ children, id = "default-factory" }: { children: ReactNode, id: string }) => {
  console.log("FactoryProvider initialized for", id);

  const {settings, updateSettings, resetSettings} = LocalStorageProvider(localstoragePrefix + id, DEFAULT_SETTINGS);

  // Init store with factory data
  const store = useStore({
    id: id,
    edges: initialEdges, 
    nodes: initialNodes, 
    constraints: []
  });

  return (
    <FactoryContext.Provider value={{ settings, updateSettings, resetSettings, useStore: store }}>
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
