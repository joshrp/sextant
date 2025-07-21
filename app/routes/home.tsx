import { Factory } from "../factory/factory";
import { useProductionMatrix } from "~/factory/MatrixProvider";
import { FactoryProvider, useFactory } from "~/factory/FactoryProvider";

export function meta() {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  const prodMatrix = useProductionMatrix(); // Initialize the production matrix context
  const selected = prodMatrix.settings.factories[0];
  return <FactoryProvider id={selected?.id}>
    <main className="flex items-center justify-center">
      <div className="flex-1 flex flex-col items-center h-full">
        <Header />

        <Factory />
      </div>
    </main>
  </FactoryProvider>
}

function Header() {
  const name = useFactory().useStore(state => state.name);
  
  return <header className="flex flex-col items-center gap-3 h-[10vh]">
    <div className="max-w-[100vw] p-4">
      Factory {name}
    </div>
  </header>
}
