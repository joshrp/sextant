import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ArrowPathRoundedSquareIcon, ExclamationTriangleIcon, InformationCircleIcon, MinusCircleIcon } from "@heroicons/react/24/outline";
import { ArrowsPointingOutIcon, CheckCircleIcon, ChevronDownIcon, Cog8ToothIcon } from "@heroicons/react/24/solid";
import React from "react";
import { Link } from "react-router";
import { useShallow } from "zustand/shallow";
import { formatNumber, maintenanceIcon, productIcon, uiIcon } from "~/uiUtils";
import { useFactoryStore } from "../factory/FactoryContext";
import { loadData, type ProductId } from "../factory/graph/loadJsonData";

const productData = loadData()?.products;


export default function FactoryControls() {
  const solutionStatus = useFactoryStore(useShallow(state => state.solutionStatus));
  const solution = useFactoryStore(useShallow(state => state.solution));
  const scoringMethod = useFactoryStore(useShallow(state => state.scoringMethod));
  const graphUpdateAction = useFactoryStore(useShallow(state => state.graphUpdateAction));

  // if (solution?.infrastructure == undefined) useFactory().store.getState().solutionUpdateAction(false);
  const setScoreMethod = useFactoryStore(state => state.setScoreMethod);
  const infraScores = [{
    name: 'Electricity',
    icon: uiIcon('Electricity'),
    amount: solution?.infrastructure['electricity'],
    unit: 'kW'
  }, {
    name: 'Worker',
    icon: uiIcon('Worker'),
    amount: solution?.infrastructure['workers']
  }, {
    name: 'Maintenance',
    icon: maintenanceIcon('Product_Virtual_MaintenanceT1' as ProductId),
    amount: solution?.infrastructure['maintenance_1']
  }, {
    name: 'Maintenance 2',
    icon: maintenanceIcon('Product_Virtual_MaintenanceT2' as ProductId),
    amount: solution?.infrastructure['maintenance_2']
  }, {
    name: 'Maintenance 3',
    icon: maintenanceIcon('Product_Virtual_MaintenanceT3' as ProductId),
    amount: solution?.infrastructure['maintenance_3']
  }, {
    name: 'Computing',
    icon: uiIcon('Computing'),
    amount: solution?.infrastructure['computing'],
    unit: 'TFlops'
  }];

  const showScore = (solutionStatus == "Solved" || solutionStatus == "Partial") && solution;

  const hasInputGoal = useFactoryStore(state => state.goals.some(g => g.qty < 0 && g.type != "gt"));
  return (<div className="factoryControls px-2 flex justify-stretch w-full">
    <button className="p-1 block cursor-pointer" onClick={graphUpdateAction}><ArrowPathRoundedSquareIcon className="mx-auto h-full" /></button>

    <Menu key="factory-menu" as="div" className="relative">
      <MenuButton className="cursor-pointer h-full">
        <div
          data-solved={solutionStatus == "Solved" || null}
          data-blocked={solutionStatus != "Solved" || null}
          className="pl-12 text-bold text-md text-center h-full
        border-zinc-400 border-2 rounded  content-center-safe
        
        data-solved:border-green-700 data-blocked:bg-red-700
        ">
          {(solutionStatus == "Infeasible") ? (<>
            <span className="font-bold">Unsolvable</span>
          </>) : (solutionStatus == "Running") ? (<>
            <span className="font-bold">Solving...</span>
          </>) : (solutionStatus == "Error") ? (<>
            <span className="font-bold">Solver Error</span>
          </>) : showScore ? (<>
            <span className="font-bold">Score: </span>
            <span className="">{formatNumber(solution.ObjectiveValue, "")}</span>
          </>) : (<>
            <span className="font-bold">No Solution</span>
          </>)}


          <ChevronDownIcon className="w-5 ml-5 mr-2 inline text-right" />
        </div>
      </MenuButton>
      <MenuItems anchor="bottom start" className="bg-gray-800 text-gray-400 border-2 border-gray-500 rounded-sm shadow-lg relative left-0 z-10">
        <div className="text-sm p-2 align-middle border-b-1 border-gray-500">Scoring Method <InformationCircleIcon className="w-5 inline-block ml-1 -mt-1 text-gray-400" /></div>
        <MenuItem key="inputs" as="div"
          onClick={() => (scoringMethod != "inputs" ? setScoreMethod("inputs") : null)}

          className="flex flex-row p-1 pb-2 pr-2  gap-2 w-full text-left border-b-1 border-gray-500 border-dotted cursor-pointer data-focus:bg-blue-900">
          <div className="w-6 content-center">
            <span className="font-bold">
              {scoringMethod == "inputs" ? <CheckCircleIcon className="fill-green-600 w-5 inline-block" /> : <MinusCircleIcon className="w-5 inline-block" />}
            </span>
          </div>

          <div className="flex-1">
            <div className="text-center text-gray-4">
              <span>Lowest use of Inputs</span>
            </div>
            <div className="flex gap-1 mt-1">
              {solution?.products.inputs.map((i, index) => {
                const prod = productData.get(i.productId)!;
                return (<React.Fragment key={i.productId}>
                  {(index > 0 ? <span key={"plus-" + index} className="inline-block">+</span> : null)}
                  <div key={i.productId} className="flex-1 text-center text-xs text-gray-400 data-zero:opacity-20 data-zero:grayscale">
                    <div className="h-6"><img src={productIcon(prod.icon)} alt={prod.name} className="inline-block h-full" /></div>
                    <div className="mt-0.5 text-nowrap" title={i.amount?.toString() + " " + prod.unit}>{formatNumber(i.amount || 0, prod.unit, 0)}</div>
                  </div>
                </React.Fragment>)
              })}
            </div>
          </div>
        </MenuItem>
        <MenuItem key="infra" as="div"
          onClick={() => (scoringMethod != "infra" ? setScoreMethod("infra") : null)}
          className="flex flex-row p-1 pb-2  pr-2 gap-2 w-full text-left border-b-1 border-gray-500 border-dotted cursor-pointer data-focus:bg-blue-900">
          <div className="w-6 content-center">
            <span className="font-bold">
              {scoringMethod == "infra" ? <CheckCircleIcon className="fill-green-600 w-5 inline-block" /> : <MinusCircleIcon className="w-5 inline-block" />}
            </span>
          </div>

          <div className="flex-1">
            <div className="text-center text-gray-4">
              <span>Lowest use of Infrastructure</span>
            </div>
            <div className="flex gap-1 mt-1">
              {infraScores.map((i, index) => {
                return (<React.Fragment key={i.name}>
                  {(index > 0 ? <span key={"plus-" + index} className="inline-block">+</span> : null)}
                  <div key={i.name} className="flex-1 text-center text-xs text-gray-400 data-zero:opacity-20 data-zero:grayscale">
                    <div className="h-6"><img src={i.icon} alt={i.name} className="inline-block h-full mx-auto" /></div>
                    <div className="mt-0.5 text-nowrap" title={i.amount?.toString() + " " + i.unit}>{formatNumber(i.amount || 0, i.unit, 0)}</div>
                  </div>
                </React.Fragment>)
              })}
            </div>
          </div>
        </MenuItem>
        <MenuItem key="footprint" as="div"
          onClick={() => (scoringMethod != "footprint" ? setScoreMethod("footprint") : null)}
          className="flex flex-row p-1 pb-2  pr-2 gap-2 w-full text-left border-b-1 border-gray-500 border-dotted cursor-pointer data-focus:bg-blue-900">
          <div className="w-6 content-center">
            <span className="font-bold">
              {scoringMethod == "footprint" ? <CheckCircleIcon className="fill-green-600 w-5 inline-block" /> : <MinusCircleIcon className="w-5 inline-block" />}
            </span>
          </div>

          <div className="flex-1">
            <div className="text-center text-gray-4">
              <span>Lowest Machine Footprint</span>
            </div>
            <div className="flex gap-1 mt-1">
              {solution?.infrastructure['footprint'] != undefined ? (<>
                <div className="flex-1 text-center text-xs text-gray-400 data-zero:opacity-20 data-zero:grayscale">
                  <div className="h-6"><ArrowsPointingOutIcon className="inline-block h-full mx-auto" /></div>
                  <div className="mt-0.5 text-nowrap" title={solution?.infrastructure['footprint']?.toString() + " tiles"}>{formatNumber(solution?.infrastructure['footprint'] || 0, " tiles", 0)}</div>
                </div>
              </>) : (<span className="flex-1 text-center text-xs text-gray-600 italic">No machines used</span>)}
            </div>
          </div>
        </MenuItem>
        <MenuItem key="divider" as="div" className="border-b-2 border-gray-500 my-1" />
        <MenuItem key="outputs" as="div"
          onClick={() => (scoringMethod != "outputs" ? setScoreMethod("outputs") : null)}
          data-disabled={hasInputGoal == false || null} data-enabled={hasInputGoal == true || null}
          className="group flex flex-row p-1 pb-2 pr-2 gap-2 w-full text-left 
            border-b-1 border-gray-500 border-dotted 
            data-enabled:cursor-pointer data-enabled:data-focus:bg-blue-900">
          <div className="w-6 content-center">
            <span className="font-bold">
              {scoringMethod == "outputs" ? <CheckCircleIcon className="fill-green-600 w-5 inline-block" /> : <MinusCircleIcon className="w-5 inline-block" />}
            </span>
          </div>
          <div className="flex-1 group-data-[disabled]:brightness-50">
            <div className="text-center ">
              <span>Highest amount of Outputs</span>
            </div>
            <div className="flex gap-1 mt-1">
              {solution?.products.outputs.map((i, index) => {
                const prod = productData.get(i.productId)!;
                return (<React.Fragment key={i.productId}>
                  {(index > 0 ? <span key={"plus-" + index} className="inline-block">+</span> : null)}
                  <div key={i.productId} className="flex-1 text-center text-xs data-zero:opacity-20 data-zero:grayscale">
                    <div className="h-6"><img src={productIcon(prod.icon)} alt={prod.name} className="inline-block h-full" /></div>
                    <div className="mt-0.5 text-nowrap" title={i.amount?.toString() + " " + prod.unit}>{formatNumber(i.amount || 0, prod.unit, 0)}</div>
                  </div>
                </React.Fragment>)
              })}
            </div>
            <div className="block text-center text-red-400"><ExclamationTriangleIcon className="w-4 inline-block stroke-red-400 " /> Unavailable without an Input based goal</div>
          </div>
        </MenuItem>
      </MenuItems>
    </Menu >

    <div className="costs pl-4 mt-0.5 align-middle flex-1 h-full grid auto-cols-fr grid-flow-col grid-rows-1 py-0.5 gap-1 justify-around content-start">
      {solutionStatus == "Solved" && solution ? (<>
        {infraScores.map((i) => {
          return (<div key={i.name}
            className="grid gap-0.5 grid-rows-[minmax(0,2fr)_min-content]
            text-center text-xs text-gray-400 data-zero:opacity-20 data-zero:grayscale"
            title={i.name + (i.unit ? (" (" + i.unit + ")") : "")}>
            <div className="">
              <img src={i.icon} alt={i.name} className="mx-auto h-full inline-block" />
            </div>
            <div className="text-nowrap ">{formatNumber(i.amount || 0, i.unit, 0)}</div>
          </div>)
        })}

        {solution?.infrastructure['footprint'] != undefined ? (<>
          <div key="footprint"
            className="grid gap-0.5 grid-rows-[minmax(0,2fr)_min-content]
            text-center text-xs text-gray-400 data-zero:opacity-20 data-zero:grayscale" title={"Machine Footprint (tiles)"}>
            <div className=""><ArrowsPointingOutIcon className="inline-block h-full mx-auto" /></div>
            <div className="text-nowrap">{formatNumber(solution?.infrastructure['footprint'] || 0, "t", 0)}</div>
          </div>
        </>) : null}

      </>) : null}
    </div>

    <div className="px-2 cursor-pointer justify-self-end-safe content-center-safe hover:brightness-70" title="Factory Settings">
      <Link to="settings" className="h-full">
        <Cog8ToothIcon className="w-6 inline-block" />
      </Link>

    </div>
  </div >
  );
}
