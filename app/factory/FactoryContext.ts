import { createContext, useContext } from "react";

import { type FactoryStore, type GraphStore } from "./store";
import { useStore } from "zustand";

export type FactorySettings = {
  id: string; // Unique identifier for the factory
  name: string;
  icon?: string;
}

type FactoryContextType = {
  store: FactoryStore["Graph"];
  historical: FactoryStore["Historical"];
};

export const FactoryContext = createContext<FactoryContextType | undefined>(undefined);

export default function useFactory() {
  const context = useContext(FactoryContext);
  if (!context) {
    throw new Error("useFactory must be used within a FactoryProvider");
  }
  return context;
}

export function useFactoryStore<U>(selector: (state: GraphStore) => U): U {
  return useStore(useFactory().store, selector);
}
