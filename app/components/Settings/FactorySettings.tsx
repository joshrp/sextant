import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useShallow } from "zustand/shallow";

import { ClipboardIcon, FolderArrowDownIcon, InformationCircleIcon } from "@heroicons/react/24/outline";

import useFactory, { useFactoryStore } from "~/factory/FactoryContext";
import { loadData, type ProductId } from "~/factory/graph/loadJsonData";
import { compress, minify } from "~/factory/importexport/importexport";
import useProductionMatrix from "~/context/ZoneContext";
import type { MatrixStoreData } from "~/context/ZoneProvider";
import { useStableParam } from "~/routes";
import { productIcon } from "~/uiUtils";
import { SelectorDialog } from "../Dialog";

const { products } = loadData();

const settingsTabs = [
  { id: "weights", name: "Weights" },
  { id: "importexport", name: "Import/Export" },
  { id: "advanced", name: "Advanced" },
];
const tabIds = settingsTabs.map(t => t.id);

export default function FactorySettings() {
  const navigate = useNavigate();

  const { name } = useFactoryStore(useShallow(state => ({ id: state.id, name: state.name })));
  const [exportedStr, setExportedStr] = useState("Something went wrong exporting Factory");
  const tabParam = useStableParam("tabId");
  const prodMatrixStore = useProductionMatrix().store;
  const lastTab = prodMatrixStore.getState().lastSettingsTab;

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
      prodMatrixStore.setState((state) => ({ ...state, lastSettingsTab: tabId }), false, "Set lastSettingsTab");
    }
  }, [tabParam, lastTab]);

  const minState = minify(useFactoryStore(useShallow(state => state)));
  useEffect(() => {
    compress(minState).then(setExportedStr)
      .catch(e => setExportedStr("Error Exporting Factory: " + e));
  }, [minState, setExportedStr]);
  let content;
  switch (tabId) {
    case "weights":
      content = <FactoryWeights />;
      break;
    case "importexport":
      content = <div>
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
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded duration-500 transition-all data-done:bg-black mb-4 ml-4 cursor-pointer"
          onClick={e => {
            navigator.clipboard.writeText(exportedStr)
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
        <textarea key="factoryExportStr" value={exportedStr} readOnly onClick={e => (e.target as HTMLTextAreaElement).select()}
          className="w-full max-h-[80vh] p-4 overflow-ellipsis field-sizing-content bg-gray-700 rounded text-xs font-mono" />

      </div>;
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

function FactoryWeights() {
  const matrixStore = useProductionMatrix().store;

  const factoryStore = useFactory().store;

  const matrixWeights = useFactoryStore(state => state.baseWeights);
  const weights = useFactoryStore(state => state.weights);

  const baseWeights: Map<ProductId, number> = new Map();

  const setPreset = (preset: MatrixStoreData["weights"]["base"]) => {
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
