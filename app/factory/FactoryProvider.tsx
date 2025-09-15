import { useRef, type ReactNode } from "react";
import {FactoryContext} from "./FactoryContext";
import Store, { type FactoryStore } from "./store";

export const FactoryProvider = ({ children, id = "default-factory" }: { children: ReactNode, id: string }) => {
  console.log("FactoryProvider initialized for", id);
  const storeRef = useRef<FactoryStore | null>(null);
  
  if (!storeRef.current || storeRef.current?.getInitialState().id !== id) {
    // Initialize store only once
    storeRef.current = Store({
      id: id,
      edges: [], 
      nodes: [], 
      goals: [],
    });
  }

  return (
    <FactoryContext.Provider value={{ store: storeRef.current }}>
      {children}
    </FactoryContext.Provider>
  );
};
