import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { ProductionZoneStore, ProductionZoneStoreData } from "./ZoneStore";
import type { GraphCoreData, GraphImportData } from "~/factory/store";
import type { IDB } from "./idb";
import type { ArchivedFactoryMetadata } from "./factoryArchive";

type ProductionZoneContextType = {
  store: ProductionZoneStore;
  idb: IDB;
  id: string;
  name: string;
  importFactory(data: GraphImportData): void;
  archiveFactory(factoryId: string, factoryData: GraphCoreData): Promise<ArchivedFactoryMetadata>;
  restoreFactory(archiveId: string): Promise<string>;
  deleteFactory(factoryId: string): Promise<void>;
  listArchivedFactories(): Promise<ArchivedFactoryMetadata[]>;
  deleteArchivedFactory(archiveId: string): Promise<void>;
};

export const ProductionZoneContext = createContext<ProductionZoneContextType | undefined>(undefined);

export default function useProductionZone() {
  const context = useContext(ProductionZoneContext);
  if (!context) {
    throw new Error("useProductionZone must be used within a ProductionZoneProvider");
  }
  return context;
};

export function useProductionZoneStore<U>(selector: (state: ProductionZoneStoreData) => U): U {
  return useStore(useProductionZone().store, selector);
}
