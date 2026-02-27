import { useEffect } from "react";
import { Link, useNavigate } from "react-router";

import { ChevronDownIcon, ClipboardIcon, InformationCircleIcon } from "@heroicons/react/24/outline";

import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import usePlanner, { usePlannerStore } from "~/context/PlannerContext";
import { default as useProductionMatrix } from "~/context/ZoneContext";
import type { ProductionZoneStoreData } from "~/context/ZoneProvider";
import useFactory, { useFactoryStore } from "~/factory/FactoryContext";
import { loadData, type ProductId } from "~/factory/graph/loadJsonData";
import { getRecipeInputs, getRecipeOutputs } from "~/gameData/utils";
import { isRecipeNode } from "~/factory/graph/nodes";
import hydration from "~/hydration";
import { useStableParam } from "~/routes";
import { productIcon } from "~/uiUtils";
import { SelectorDialog } from "../Dialog";
import ExportPane from "./ExportPane";
import ImportPane from "./ImportPane";

const { products } = loadData();

const settingsTabs = [
  { id: "weights", name: "Weights" },
  { id: "export", name: "Export" },
  { id: "import", name: "Import" },
  { id: "debug", name: "Debug" },
  { id: "advanced", name: "Advanced" },
];
const tabIds = settingsTabs.map(t => t.id);

export default function FactorySettings() {
  const navigate = useNavigate();
  const tabParam = useStableParam("tab", "");

  const plannerStore = usePlanner().store;
  const lastTab = plannerStore.getState().lastSettingsTab;

  let tabId = `${tabParam}`;
  // If there's no tab, or the tab isn't valid. Go to the last tab, if that's not valid go to weights
  useEffect(() => {
    console.log('Settings tab effect', { tabParam, tabId, lastTab });
    if (!tabParam || !tabIds.includes(tabParam)) {
      if (lastTab && tabIds.includes(lastTab))
        tabId = lastTab
      else
        tabId = "weights";

      console.log('No tab in URL, send to:', tabId);
      navigate(`../settings/${tabId}`, { replace: true });
    }
    else if (lastTab !== tabId) {
      console.log('Setting lastSettingsTab from', lastTab, 'to', tabId);
      plannerStore.setState((state) => ({ ...state, lastSettingsTab: tabId }), false, "Set lastSettingsTab");
    }
  }, [tabParam, lastTab]);


  let content;
  switch (tabId) {
    case "weights":
      content = <FactoryWeights />;
      break;
    case "export":
      content = <ExportPane />;
      break;
    case "import":
      content = <ImportPane />;
      break;
    case "debug":
      content = <FactoryDebug />;
      break;
    case "advanced":
      content = <div>
        Advanced Settings (to be implemented)
      </div>;
      break;
    default:
      content = <div>Unknown tab</div>;
  }
  return (
    <SelectorDialog isOpen={true} setIsOpen={() => { navigate('../'); }} title="Settings"
      heightClassName="h-[90vh]"
      widthClassName="w-7/8"
    >
      <div className="flex border-b border-gray-700 mb-4">
        {settingsTabs.map(tab => (
          <Link
            key={tab.id}
            to={`../settings/${tab.id}`}
            data-testid={`settings-tab-${tab.id}`}
            // onClick={() => {
            //   // setSelectedTab(tab.id);
            //   navigate(`${parentUrl}/settings/${tab.id}`, { replace: true });
            // }}
            className={`px-4 py-2 -mb-px border-b-2 font-medium ${tabId === tab.id ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'}`}
          >
            {tab.name}
          </Link>
        ))}
      </div>
      <div className="overflow-y-auto h-full">
        {content}
      </div>
    </SelectorDialog>
  );
}

function FactoryWeights() {
  const matrixStore = useProductionMatrix().store;

  const factoryStore = useFactory().store;

  const matrixWeights = useFactoryStore(state => state.baseWeights);
  const weights = useFactoryStore(state => state.weights);

  const baseWeights: Map<ProductId, number> = new Map();

  const setPreset = (preset: ProductionZoneStoreData["weights"]["base"]) => {
    matrixStore.setState(state => ({ weights: { ...state.weights, base: preset } }), false);
    factoryStore.setState(state => ({ baseWeights: { ...state.weights, base: preset } }), false);
  };


  /**
   *  TODO:: Presets save but don't do anything. Weights don't save.
   *       - Need a save button up top that saves to both stores
   *       - Need to hide non-changed weights unless "show all" is toggled
   */

  return <div className="product-weights">
    <div className="presets">
      <h2>Presets - {matrixWeights.base}</h2>
      <div className="flex space-x-2">
        <button onClick={() => setPreset('early')} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Early Game</button>
        <button onClick={() => setPreset('mid')} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Mid Game</button>
        <button onClick={() => setPreset('late')} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Late Game</button>
        <button onClick={() => setPreset('end')} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">End Game</button>
      </div>
    </div>
    <hr className="my-4 border-t border-gray-300" />
    <h2></h2>
    <table className="w-full">
      <thead>
        <tr>
          <th>Product</th>
          <th>Default <InformationCircleIcon className="inline-block w-5" /></th>
          <th>User <InformationCircleIcon className="inline-block w-5" /></th>
          <th>Factory <InformationCircleIcon className="inline-block w-5" /></th>
        </tr>
      </thead>
      <tbody>
        {Array.from(products.values()).map(p => (
          <tr key={p.id}>
            <td>
              <img src={productIcon(p.icon)} alt={p.name} className="inline w-6 h-6 mr-2 align-middle" />
              {p.name}
            </td>
            <td>
              <span>{baseWeights.get(p.id) ?? 0}</span>
            </td>
            <td>
              <input type="number" className="w-20 p-1 bg-gray-700 m-1 rounded" value={matrixWeights.products.get(p.id)} />
            </td>
            <td>
              <input type="number" className="w-20 p-1 bg-gray-700 m-1  rounded" value={weights.products.get(p.id)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

}

function FactoryDebug() {
  const factoryStore = useFactory().store.getState();
  const plannerStore = usePlanner().store;
  const debugSolverEnabled = usePlannerStore(state => state.debugSolver);

  const toggleDebugSolver = () => {
    plannerStore.getState().setDebugSolver(!debugSolverEnabled);
  };

  const graphData = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.layered.spacing.nodeNodeBetweenLayers": "200",
      "elk.layered.spacing.nodeNode": "50",
      "elk.spacing.nodeNode": "50",
      "elk.spacing.edgeEdge": "50",
      "elk.spacing.edgeNode": "50",
      "elk.edgeRouting": "SPLINES",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.crossingMinimization.semiInteractive": "true",
      "elk.debug.enable": "false",
      "elk.nodeLabels.placement": "INSIDE V_TOP H_CENTER",
      "elk.portConstraints": "FIXED_SIDE",
      "elk.stress.spacing.nodeNodeBetweenLayers": "100",
      "elk.stress.spacing.nodeNode": "50",
      "elk.spacing.portPort": "100",
      "elk.layered.nodePlacement.favorStraightEdges": "true"
    },
    children: factoryStore.nodes.filter(isRecipeNode).map(n => {
      const inputs = getRecipeInputs(n.data.recipeId);
      const outputs = getRecipeOutputs(n.data.recipeId);

      const ports = inputs.map(product => ({
        id: `${n.id}-in-${product.id}`,
        product: product.id,
        properties: {
          "port.side": n.data.ltr ? "WEST" : "EAST",
        }
      }));

      ports.push(...outputs.map(product => ({
        id: `${n.id}-out-${product.id}`,
        product: product.id,
        properties: {
          "port.side": n.data.ltr ? "EAST" : "WEST",
        }
      })));

      return {
        id: n.id,
        width: n.measured?.width,
        height: n.measured?.height,
        x: n.position.x,
        y: n.position.y,
        labels: [{ text: n.data.recipeId }],
        ports,
        layoutOptions: {
          'elk.portAlignment.default': 'END',
          "elk.portConstraints": "FIXED_SIDE",
        }
      }
    }),
    edges: factoryStore.edges.map(e => ({
      id: e.id,
      sources: [`${e.source}-out-${e.sourceHandle}`],
      targets: [`${e.target}-in-${e.targetHandle}`],
      labels: [{ text: e.sourceHandle }],
    })),
  };
  
  const testData = useFactory().store.getState().exportTestData();
  
  return <div className="factory-debug">
    <div className="mb-6 p-4 bg-gray-800 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium mb-1">Solver Debug Logging</h3>
          <p className="text-sm text-gray-400">Enable verbose console logging for the linear programming solver</p>
        </div>
        <button
          onClick={toggleDebugSolver}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
            debugSolverEnabled ? 'bg-blue-600' : 'bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
              debugSolverEnabled ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
    <Disclosure defaultOpen={true}>
      <DisclosureButton className="group cursor-pointer flex w-full gap-4 justify-center-safe px-4 py-2">
        Solver Test Data Export <ChevronDownIcon className="w-5 justify-self-end-safe group-data-open:rotate-180" />
      </DisclosureButton>
      <DisclosurePanel>
        <p className="mb-4 text-sm text-gray-300">
          Export the current factory state as a JSON test case for unit testing the solver.
          This includes all inputs (nodes, edges, goals, manifolds, scoring method) and expected outputs (solution data).
        </p>
        <ClipboardCopyButton text={testData} />
        <div className="p-4 mt-2 bg-gray-900 rounded-lg max-h-80 overflow-auto">
          <pre className="text-xs text-left cursor-text select-all">
            {testData}
          </pre>
        </div>
      </DisclosurePanel>
      <DisclosureButton className="group cursor-pointer flex w-full gap-4 justify-center-safe px-4 py-2">
        Factory Store Data <ChevronDownIcon className="w-5 justify-self-end-safe group-data-open:rotate-180" />
      </DisclosureButton>
      <DisclosurePanel>
        <ClipboardCopyButton text={JSON.stringify(factoryStore, hydration.replacer, 2)} />
        <div className="p-4 mt-2 bg-gray-900 rounded-lg max-h-80 overflow-auto">
          <pre className="text-xs text-left" onClick={e => (e.target as HTMLTextAreaElement).select()}>
            {JSON.stringify(factoryStore, hydration.replacer, 2)}
          </pre>
        </div>
      </DisclosurePanel>
      <DisclosureButton className="group cursor-pointer flex w-full gap-4 justify-center-safe px-4 py-2">
        ELK Format <ChevronDownIcon className="w-5 justify-self-end-safe group-data-open:rotate-180" />
      </DisclosureButton>
      <DisclosurePanel>
        <ClipboardCopyButton text={JSON.stringify(graphData, hydration.replacer, 2)} />
        <div className="p-4 mt-2 bg-gray-900 rounded-lg max-h-80 overflow-auto">
          <pre className="text-xs text-left" onClick={e => (e.target as HTMLTextAreaElement).select()}>
            {JSON.stringify(graphData, hydration.replacer, 2)}
          </pre>
        </div>
      </DisclosurePanel>
    </Disclosure>

  </div>;
}


function ClipboardCopyButton({ text }: { text: string }) {

  return <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded duration-500 transition-all data-done:bg-zinc-950 mb-4 ml-4 cursor-pointer"
    onClick={e => {
      navigator.clipboard.writeText(text)
        .then(() => {
          const btn = e.target as HTMLButtonElement;
          if (btn) {
            btn.setAttribute("data-done", "true");
            setTimeout(() => {
              btn.removeAttribute("data-done");
            }, 500);
          }
        })
        .catch(e => {
          alert("Error copying to clipboard: " + e);
        });
    }}
  >
    <ClipboardIcon className="inline-block w-5" /> Copy to Clipboard
  </button>
}
