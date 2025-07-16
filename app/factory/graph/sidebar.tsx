import { Button, Field, Fieldset, Input, Label, Menu, MenuButton, MenuItem, MenuItems, Radio, RadioGroup } from '@headlessui/react';
import { ClockIcon, PlusIcon } from '@heroicons/react/24/solid';
import { useCallback, useState, type ChangeEvent } from 'react';

import { SelectorDialog } from 'app/components/Dialog';
import { useFactory } from 'app/factory/FactoryProvider';
import type { FactoryGoal } from 'app/factory/solver';
import { loadProductData, type Product, type ProductId } from './loadJsonData';
import type { Solution } from '../factory';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

// const transformSelector = (state: any) => state.transform;
const productData = loadProductData();

type props = {
  calcResults: Solution | null;
  addNewRecipe: (productId: ProductId) => void
};

function SideBar({ calcResults, addNewRecipe }: props) {
  // const transform = useStore(transformSelector);
  const useStore = useFactory().useStore;

  const recalc = useStore(state => state.graphChangeAction);
  const goals = useStore(state => state.constraints);

  const [editGoal, setEditGoal] = useState<FactoryGoal | null>(null);
  const addGoal = useCallback((goal: FactoryGoal): void => {
    const exists = goals.findIndex(g => goal.productId == g.productId);
    useStore.setState(state => {
      if (exists !== -1)
        state.constraints[exists] = goal;
      else
        state.constraints.push(goal);
      return state;
    });

    setEditGoal(null);
  }, [goals, useStore]);

  const editGoalFor = (product: Product) => {
    setEditGoal({
      dir: "output",
      type: "eq",
      productId: product.id,
      qty: 10
    });
  }

  const [selectProductDialog, setSelectProductDialog] = useState(false);
  const menuOptions = [{
    label: "Edit",
    onClick: (c: FactoryGoal) => () => setEditGoal(c)
  }, {
    label: "Remove",
    onClick: (goal: FactoryGoal) => () => {
      // Filter for only constraints that don't match this product
      console.log("removing", goal)
      useStore.setState(state => ({
        constraints: state.constraints.filter(c => c.productId !== goal.productId)
      }))
    }
  }, {
    label: "Add Producer",
    onClick: (goal: FactoryGoal) => () => addNewRecipe(goal.productId),
  }]
  return (<>
    <div className='sidebar h-full p-2 border-r-2 border-dotted border-gray-300 dark:border-gray-700'>
      <div className="title">Goals</div>
      <div className="bg-gray-800">
        {goals.map(c => {
          const fulfilled = false;// constraints.openOutputs.findIndex(val => desire.id == val) > -1;
          return <Menu>
            <MenuButton className={`output-goal w-full p-2 flex h-10 my-1
                                  bg-gray-700 hover:bg-gray-900
                                    rounded cursor-pointer 
                                    border-1 border-gray-500 ${fulfilled ? "bg-green-900" : "bg-red-950"}`}
            >
              <div className="flex-1 justify-self-start">
                <img className="h-full" src={'/assets/products/' + productData[c.productId].icon} />
              </div>
              <div className="w-full flex-1 justify-self-end-safe text-right text-xs text-nowrap">
                {(() => {
                  switch (c.type) {
                    case "eq":
                      return "Exactly";
                    case "lt":
                      return "Max of";
                    case "gt":
                      return "Min of";
                  }
                })()} {c.qty}
              </div>
            </MenuButton>
            <MenuItems anchor="bottom start" className="bg-gray-800 border-1 border-gray-600 rounded">
              {menuOptions.map(m =>
                <MenuItem onClick={m.onClick(c)} as="button" className="p-2 px-4 w-full text-center block border-b-1 border-gray-600 cursor-pointer data-focus:bg-blue-900">
                  {m.label}
                </MenuItem>
              )}
            </MenuItems>
          </Menu>
        })}
        <button onClick={() => setSelectProductDialog(true)} className="cursor-pointer bg-gray-700 rounded hover:bg-gray-900 focus:bg-gray-900 active:bg-gray-900 ">
          <div className="inline-flex text-center w-8 align-middle">
            <PlusIcon />
          </div>
        </button>

      </div>
      <div className="subtitle">By Products</div>

      <div className="bg-gray-800 p-2">
        {calcResults?.products?.outputs.map(output => {
          const goal = goals.find(g => g.productId === output.productId && g.dir == "output");
          let amount = output.amount;
          let isSurplus = false;
          if (goal) {
            amount -= goal.qty;
            isSurplus = true;
          }
          if (amount <= 0) return;

          return <div className={`"output-goal w-full p-2 flex h-10 my-1
                                bg-gray-700 hover:bg-gray-900
                                rounded cursor-pointer 
                                border-1 border-gray-500 ${isSurplus ? "bg-green-900" : ""}`}>
            <img className="flex-1 h-full justify-self-start" src={'/assets/products/' + productData[output.productId].icon} />
            <span className="flex-8 justify-self-end-safe text-right">{amount} {isSurplus ? "extra" : ""}</span>
          </div>
        })}
      </div>
      <div className="subtitle">Inputs</div>
      <div className="bg-gray-800 p-1">
        {calcResults?.products?.inputs.map(input => {
          // const goal = goals.find(g => g.productId === input.productId && g.dir == "input");
          let amount = input.amount * -1;
          let isSurplus = false;
          // if (goal) {
          //   amount -= goal.qty;
          //   isSurplus = true;
          // }
          if (amount <= 0) return;

          return <div className={`"input-goal w-full p-2 flex h-10 my-1
                                bg-gray-700 hover:bg-gray-900
                                rounded cursor-pointer 
                                border-1 border-gray-500 ${isSurplus ? "bg-green-900" : ""}`}>
            <img className="flex-1 h-full justify-self-start" src={'/assets/products/' + productData[input.productId].icon} />
            <span className="flex-8 justify-self-end-safe text-right">{amount} {isSurplus ? "extra" : ""}</span>
          </div>
        })}
      </div>
      <button className="h-10 py-1 w-20 mx-auto my-4 block bg-blue-500 cursor-pointer" onClick={recalc}><ArrowPathIcon className="mx-auto h-full"/></button>
    </div>
    {selectProductDialog ? (
      <SelectorDialog title={"Select Product to make"} isOpen={selectProductDialog} setIsOpen={setSelectProductDialog}>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(50px,4fr))] gap-2 overflow-y-auto">
          {(Object.keys(productData) as ProductId[]).map((key) => {
            const item = productData[key]
            return (<div key={item.id} className="">
              <div id={"tooltip-" + item.id} role="tooltip" className="absolute z-10 invisible inline-block px-3 py-2 text-sm font-medium text-white transition-opacity duration-300 bg-gray-900 rounded-lg shadow-xs opacity-0 tooltip dark:bg-gray-700">
                {item.name}
                <div className="tooltip-arrow" data-popper-arrow></div>
              </div>
              <button
                data-tooltip-target={"tooltip-" + item.id}
                className="bg-transparent hover:bg-gray-500 hover:border hover:border-black-500 rounded block"
                onClick={() => editGoalFor(item)}
              ><img src={'/assets/products/' + item.icon} alt={item.name} className="inline-block p-2" />
              </button>
            </div>)
          })}
        </div>
      </SelectorDialog>

    ) : ("")}
    {editGoal ? (
      <SelectorDialog title={"Change " + productData[editGoal.productId].name + " Goal"} isOpen={editGoal !== null} setIsOpen={() => setEditGoal(null)}>
        <NewProductOptions addGoal={addGoal} goal={editGoal} />
      </SelectorDialog>
    ) : ("")}
  </>);
};

type NewProductOptionsProps = {
  goal: FactoryGoal,
  addGoal: (goal: FactoryGoal) => void,
}
function NewProductOptions({ goal, addGoal }: NewProductOptionsProps) {
  const [goalData, setGoalData] = useState(goal);

  const updateState = (e: ChangeEvent<HTMLInputElement>) => {
    const prop = e.target.name;
    if (!prop) return;
    setGoalData(d => ({ ...d, [prop]: (e.target.value) }));
  }
  return <>
    <Fieldset className="w-full min-h-50 flex flex-col gap-4">

      {/* <RadioGroup className="flex justify-stretch w-full gap-2"> */}
      <RadioGroup name="type" value={goalData.type} onChange={v => setGoalData(d => ({ ...d, type: v }))} className="flex justify-stretch w-full gap-2">
        {[["Minimum of", "gt"], ["Exactly", "eq"], ["Maximum of", "lt"]].map(r => (
          <Field className="flex-1 justify-around gap-2">
            <Radio key={r[1]} value={r[1]} className="group block rounded border-1 data-checked:border-2 border-gray-700 data-checked:bg-teal-900 w-full h-full">
              <Label >{r[0] + " " + goalData.qty}</Label>
            </Radio>
          </Field>
        ))}

      </RadioGroup>
      <Field className="flex gap-2 justify-center align-middle">
        <Label className="p-1">Amount</Label>
        <Input value={goalData.qty} onChange={updateState} className="bg-gray-600 p-1 w-[6rem]" name="qty" type="number" placeholder="50" />
        <span className="text-xs mt-2 text-gray-400">
          60 <ClockIcon className="inline w-4 pb-1  text-gray-500" />
        </span>
      </Field>
      <Field>
        <Button onClick={() => { addGoal(goalData) }} className="addItemAsGoal p-2 px-8 cursor-pointer mt-8 hover:bg-gray-900 rounded bg-gray-700 border-2 border-gray-500">Save</Button>
      </Field>
    </Fieldset>
  </>
}



export default SideBar;
