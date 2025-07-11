import type { Route } from "./+types/home";
import { Factory } from "../factory/factory";
import { ProductionMatrixProvider, useProductionMatrix } from "~/factory/FactoryProvider";
import { use } from "react";
import FactorySummary from "~/factory/summary";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  const prodMatrix = useProductionMatrix(); // Initialize the production matrix context
  const selected = prodMatrix.settings.factories[0];

  return <main className="flex items-center justify-center">
    <div className="flex-1 flex flex-col items-center h-full">
      <header className="flex flex-col items-center gap-3 h-[10vh]">
        <div className="max-w-[100vw] p-4">
          Factory {selected?.name}
          <FactorySummary />
        </div>
      </header>

      <Factory settings={selected} />
    </div>
  </main>

}
