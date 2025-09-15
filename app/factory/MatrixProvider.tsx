import { useRef, type ReactNode } from "react";
import { ProductionMatrixContext } from "./MatrixContext";
import { createStore } from "zustand";
import { devtools, persist, type StorageValue } from "zustand/middleware";
import hydration from "~/hydration";
import { openDB } from "idb";

export const ProductionMatrixProvider = ({ children }: { children: ReactNode }) => {
  const storeRef = useRef<MatrixStore | null>(null);

  if (!storeRef.current) {
    // Initialize store only once
    storeRef.current = Store();
  }
  return (
    <ProductionMatrixContext.Provider value={{ store: storeRef.current }}>
      {children}
    </ProductionMatrixContext.Provider>
  );
};

export type MatrixStore = ReturnType<typeof Store>;
export interface MatrixStoreData {
  factories: {
    id: string,
    order: number,
    name: string
  }[],
  selected: string,
  weights: { [k: string]: number },

  changeTab(id: string): void;
  newFactory(name: string): void;
};

const isClient = typeof window !== "undefined";
const version = 1;
const Store = () => {
  const idb = isClient ? openDB("ProductionMatrixStore", version, {
    upgrade(db, oldVersion, newVersion, transaction, event) {
      db.createObjectStore('current-state');
    },
    // blocked(currentVersion, blockedVersion, event) {
    //   // …
    // },
    // blocking(currentVersion, blockedVersion, event) {
    //   // …
    // },
    // terminated() {
    //   // …
    // },
  }) : null;

  return createStore<MatrixStoreData>()(
    persist(
      devtools(
        (set, get) => ({
          factories: [{
            id: "default-factory",
            name: "Default Factory",
            order: 0,
          }],
          selected: "default-factory",
          weights: {},

          changeTab: (id: string) => {
            const settings = get();
            console.log("Changing tab to", id, settings);
            if (settings.factories.find(f => f.id === id)) {
              set({ selected: id });
            }
          },
          newFactory: (name: string) => {
            const settings = get();
            const newId = name.trim().toLowerCase().replace(/\s+/g, "-");
            if (settings.factories.some(f => f.id === newId)) {
              alert("Factory with this name already exists.");
              return;
            }
            set({
              factories: [...settings.factories, {
                id: newId,
                name: name.trim(),
                order: settings.factories.length
              }]
            });
          }
        })
      ),
      {
        name: "ProductionMatrix_settings",
        storage: {
          getItem: async (name) => {
            // const str = localStorage.getItem('ProductionMatrix_settings');
            if (!idb) return null;
            const str = await (await idb).get('current-state', name);

            if (!str) return null;
            return JSON.parse(str, hydration.reviver);
          },
          setItem: async (name, newValue: StorageValue<MatrixStoreData>) => {
            if (!idb) return;
            const str = JSON.stringify(newValue, hydration.replacer);

            return (await idb).put('current-state', str, name)
          },
          removeItem: (name) => localStorage.removeItem(name),
        }
      })

  );
}
