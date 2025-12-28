import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useShallow } from "zustand/shallow";

import { ChevronDownIcon, ClipboardIcon, FolderArrowDownIcon, InformationCircleIcon } from "@heroicons/react/24/outline";

import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import usePlanner from "~/context/PlannerContext";
import { default as useProductionMatrix, default as useProductionZone, useProductionZoneStore } from "~/context/ZoneContext";
import type { ProductionZoneStoreData } from "~/context/ZoneProvider";
import useFactory, { useFactoryStore } from "~/factory/FactoryContext";
import { loadData, type ProductId } from "~/factory/graph/loadJsonData";
import { ProductGoal } from "~/factory/graph/sidebar";
import { compress, decompress, minify, unminify } from "~/factory/importexport/importexport";
import type { FactoryGoal } from "~/factory/solver/types";
import type { GraphImportData } from "~/factory/store";
import { getRecipeInputs, getRecipeOutputs } from "~/gameData/utils";
import hydration from "~/hydration";
import { useStableParam } from "~/routes";
import { productIcon } from "~/uiUtils";
import { SelectorDialog } from "../Dialog";

const { products } = loadData();

const settingsTabs = [
  { id: "weights", name: "Weights" },
  { id: "importexport", name: "Import/Export" },
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
    case "importexport":
      content = <>
        <FactoryExport />
        <hr className="my-4 border-t border-gray-300" />
        <FactoryImport />
      </>;
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

function FactoryImport() {
  const [importStr, setImportStr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newFactoryData, setNewFactoryData] = useState<GraphImportData | null>(null);
  const zone = useProductionZone();
  const currentFactories = useProductionZoneStore(state => state.factories);
  const [importingWait, setImportingWait] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (importingWait && !newFactoryData) {
      setImportingWait(false);
    }
    if (importingWait && newFactoryData) {
      const newFactory = currentFactories.find(f => f.name == newFactoryData.name);
      // If it's been added to the array, it will be available to see, even if some parts don't work
      if (newFactory) {
        setImportStr("");
        setError(null);
        setNewFactoryData(null);
        setImportingWait(false);
        nav(`/zones/${zone.id}/${newFactory.id}`);
      }
    }
  }, [importingWait, newFactoryData]);


  useEffect(() => {
    setError(null);
    if (importStr.length < 10) return; // Too short to be valid
    decompress(importStr).then(minData => {
      const data = unminify(minData);

      setNewFactoryData(data)
      setError(null);
    }).catch(e => {
      console.error("Error importing factory:", e);
      setError("Error importing factory: " + e);
    });
  }, [importStr, setError]);

  return <div className="factory-import flex flex-col gap-2">
    <h2 className="text-lg font-medium mb-2">Import Factory</h2>

    <p className="mb-4">Paste in a previously exported factory string below to import it.</p>
    <textarea key="factoryImportStr" value={importStr} onChange={e => setImportStr(e.target.value)}
      className="w-full h-48 p-4 overflow-ellipsis field-sizing-content bg-gray-700 rounded text-xs font-mono mb-4" />
    {error && <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
      <span className="font-medium">Error:</span> {error}
    </div>}
    {newFactoryData && <>
      <input type="text" className="inline-block mx-auto p-2 bg-gray-700 rounded text-white"
        value={newFactoryData.name}
        onChange={e => setNewFactoryData({ ...newFactoryData, name: e.target.value })}
        placeholder="Factory Name" />
      {currentFactories.find(f => f.name == newFactoryData.name) &&
        <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
          A factory with this name already exists in this zone.
        </div>
      }
      <h3>{newFactoryData.nodes.length} Nodes / {newFactoryData.edges.length} Edges / {newFactoryData.goals.length} Goals:</h3>
      <div className="goals w-full max-w-70 flex flex-col gap-2 justify-center-safe mx-auto">
        {newFactoryData.goals.map((g, i) => <div key={i} className="flex flex-1 flex-row border-1 rounded p-2 bg-gray-900 border-gray-600">
          <ProductGoal goal={g as FactoryGoal} />
        </div>
        )}
      </div>
      <button className="import mx-auto inline-block p-4 px-8 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer"
        onClick={() => {
          if (!importingWait && !newFactoryData) return;
          setImportingWait(true);
          zone.importFactory(newFactoryData);
        }}
      >Import as New Factory</button>
    </>}
  </div>
}


function FactoryExport() {
  const minState = minify(useFactoryStore(useShallow(state => state)));
  const [exportedStr, setExportedStr] = useState("Something went wrong exporting Factory");

  useEffect(() => {
    compress(minState).then(setExportedStr)
      .catch(e => setExportedStr("Error Exporting Factory: " + e));
  }, [minState, setExportedStr]);
  const { name } = useFactoryStore(useShallow(state => ({ id: state.id, name: state.name })));

  return <div>
    {/* download button */}
    <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 mb-4 cursor-pointer"
      onClick={() => {
        const blob = new Blob([exportedStr], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name} Export.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }}
    >
      <FolderArrowDownIcon className="inline-block w-5" /> Download File
    </button>
    {/* Copy to clipboard */}
    <ClipboardCopyButton text={exportedStr} />
    <textarea key="factoryExportStr" value={exportedStr} readOnly onClick={e => (e.target as HTMLTextAreaElement).select()}
      className="w-full max-h-[80vh] p-4 overflow-ellipsis field-sizing-content bg-gray-700 rounded text-xs font-mono" />

  </div>;
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
    children: factoryStore.nodes.map(n => {
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

  return <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded duration-500 transition-all data-done:bg-black mb-4 ml-4 cursor-pointer"
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
