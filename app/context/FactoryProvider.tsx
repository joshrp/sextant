import { useRef, type ReactNode } from "react";
import { FactoryContext } from "../factory/FactoryContext";
import type { MatrixStoreData } from "./ZoneProvider";
import Store, { type FactoryStore } from "../factory/store";

interface FactoryProviderProps {
  children: ReactNode;
  id: string;
  name: string;
  weights: MatrixStoreData["weights"];
}

export const FactoryProvider = ({ children, id = "default-factory", name, weights }: FactoryProviderProps) => {
  const storeRef = useRef<FactoryStore | null>(null);
  
  if (!storeRef.current || storeRef.current?.Graph.getInitialState().id !== id) {
    console.log("Factory Store initialized for", id);

    // Initialize store only once
    storeRef.current = Store({ id, name });

    // Ignore persisted weights, always use provided weights from the user preferences  
    storeRef.current?.Graph.persist.onFinishHydration(state => state.setBaseWeights(weights));
  }  

  return (
    <FactoryContext.Provider value={{ store: storeRef.current?.Graph, historical: storeRef.current?.Historical }}>
      {children}
    </FactoryContext.Provider>
  );
};
