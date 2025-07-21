import { Button, Checkbox, Field, Fieldset, Input, Label, Menu, MenuButton, MenuItem, MenuItems, Radio, RadioGroup } from '@headlessui/react';
import { ClockIcon, PlusIcon } from '@heroicons/react/24/solid';
import { useCallback, useState, type ChangeEvent } from 'react';

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { SelectorDialog } from 'app/components/Dialog';
import { useFactory } from 'app/factory/FactoryProvider';
import type { FactoryGoal } from '../solver/types';
import { loadProductData, type Product, type ProductId } from './loadJsonData';

// const transformSelector = (state: any) => state.transform;
const productData = loadProductData();
const productIcon = (id: string) => `/assets/products/${productData[id].icon}`;

type props = {
  addNewRecipe: (productId: ProductId) => void
};



const icons = {
  "gt": "\u2265",
  "lt": "\u2264",
  "eq": "\u003D"
}

function SideBar({ addNewRecipe }: props) {
  // const transform = useStore(transformSelector);
  const useStore = useFactory().useStore;

  const recalc = useStore().graphUpdateAction;
  const resolve = useStore().solutionUpdateAction;
  const solution = useStore(state => state.solution);
  const goals = useStore(state => state.goals);
  const model = useStore(state => state.graph);
  const edges = useStore(state => state.edges);
  const solutionUpdateAction = useStore().solutionUpdateAction;
  const freedState = useStore(state=>state.freeConstraints);

  const [editGoal, setEditGoal] = useState<FactoryGoal | null>(null);
  const addGoal = useCallback((goal: FactoryGoal): void => {
    const exists = goals.findIndex(g => goal.productId == g.productId);
    useStore.setState(state => {
      if (exists !== -1)
        state.goals[exists] = goal;
      else
        state.goals.push(goal);
      return state;
    });
    resolve();
    setEditGoal(null);
    setSelectProductDialog(false);

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
  const goalsMenuOptions = [{
    label: "Edit",
    onClick: (c: FactoryGoal) => () => setEditGoal(c)
  }, {
    label: "Remove",
    onClick: (goal: FactoryGoal) => () => {
      // Filter for only constraints that don't match this product
      useStore.setState(state => ({
        goals: state.goals.filter(c => c.productId !== goal.productId || c.dir !== goal.dir)
      }));
    }
  }, {
    label: "Add Producer",
    onClick: (goal: FactoryGoal) => () => addNewRecipe(goal.productId),
  }]
  const inputsMenuOptions = [{
    label: "Add Producer",
    onClick: <T extends { productId: string }>(input: T) => () => addNewRecipe(input.productId),
  }];

  const freed = new Set(freedState);
  const manifolds = model?.manifolds.map(m => {
    const constraint = model?.constraints[m];
    const amount = solution?.manifolds?.[m];

    if (!constraint) {
      console.error('Constraint not found for manifold', m);
    }

    const inputs: Set<Product> = new Set();
    const outputs: Set<Product> = new Set();

    Object.keys(constraint.edges).forEach(e => {
      const edge = edges.find(x => x.id == e);
      if (!edge) return
      model.graph[edge.source].recipe.inputs.map(p => inputs.add(productData[p.id]));
      model.graph[edge.target].recipe.outputs.map(p => outputs.add(productData[p.id]));
    })
    if (inputs.size == 0 || inputs.size == 0) return;


    return {
      amount,
      flexible: freed.has(m),
      ...productData[constraint.productId],
      inputs,
      outputs,
      constraintId: m,
    }
  });

  const toggleFreed = (id: string) => {
    if (freed.has(id)) 
      useStore.setState(state=>({
        freeConstraints: state.freeConstraints.filter(x => x != id)
      }));
    else
      useStore.setState(state=>({
        freeConstraints: [...state.freeConstraints, id]
      }));
    solutionUpdateAction();
  }

  return (<>
    <div className='sidebar flex flex-col h-full p-2 border-r-2 border-dotted border-gray-300 dark:border-gray-700'>
      <div className="title">Goals</div>
      <div className="bg-gray-900 flex-1 p-1">
        {goals.map((goal, i) => {
          const resultCount = solution?.goals?.find(g => g.goal.productId == goal.productId && g.goal.dir == goal.dir)?.resultCount;

          let fulfilled = false;
          if (resultCount !== undefined) {
            if (goal.type == "eq")
              fulfilled = goal.qty == resultCount;
            else if (goal.type == "lt")
              fulfilled = goal.qty >= resultCount;
            else if (goal.type == "gt")
              fulfilled = goal.qty <= resultCount;
          }

          return <Menu key={"goal-"+i}>
            <MenuButton key={"goal-" + i} as="div" className={`output-goal w-full gap-2 p-2 flex my-1
                                  hover:bg-gray-900
                                    rounded cursor-pointer 
                                    border-1 border-gray-500  text-xs 
                                    ${fulfilled ? "bg-green-900" : "bg-red-900"}
                                    `}
            >
              <div className="flex-1 max-w-10 justify-self-start">
                <img className="w-full" src={productIcon(goal.productId)} />
              </div>
              <div className="flex-3 content-center-safe">{icons[goal.type]} {goal.qty}</div>
              <div className="verticalRule self-stretch w-0.5 bg-neutral-500 opacity-50"></div>
              <div className="w-full flex-2 content-center-safe justify-self-end-safe text-right text-nowrap">
                {resultCount || ''}
              </div>
            </MenuButton>
            <MenuItems anchor="bottom start" className="bg-gray-800 border-1 border-gray-600 rounded-sm shadow-lg">
              {goalsMenuOptions.map(m =>
                <MenuItem key={"goal-item-"+m.label}onClick={m.onClick(goal)} as="button" className="p-2 px-4 w-full block text-left border-b-1 border-gray-600 cursor-pointer data-focus:bg-blue-900">
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

      <div className="bg-gray-800 p-1 flex-1">
        {solution?.products?.outputs.map((output,i) => {
          const goal = goals.find(g => g.productId === output.productId && g.dir == "output");
          let amount = output.amount;
          let isSurplus = false;
          if (goal) {
            amount -= goal.qty;
            isSurplus = true;
          }
          if (amount <= 0) return;

          return <div key={"output-"+i} className={`"output-goal w-full p-2 flex h-10 my-1
                                bg-gray-700 hover:bg-gray-900
                                rounded cursor-pointer 
                                border-1 border-gray-500 ${isSurplus ? "bg-green-900" : ""}`}>
            <img className="flex-1 h-full justify-self-start" src={'/assets/products/' + productData[output.productId].icon} />
            <span className="flex-8 justify-self-end-safe text-right">{amount} {isSurplus ? "extra" : ""}</span>
          </div>
        })}
      </div>
      <div className="subtitle">Inputs</div>
      <div className="bg-gray-800 p-1 flex-1">
        {solution?.products?.inputs.map((input, i) => {
          const amount = input.amount * -1;
          if (amount <= 0) return;
          return <Menu key={"input-" + i}>
            <MenuButton as="div" className={`"input-goal w-full p-2 flex h-10 my-1
                                bg-gray-700 hover:bg-gray-900
                                rounded cursor-pointer 
                                border-1 border-gray-500 `}
            >
              <img className="flex-1 h-full justify-self-start" src={'/assets/products/' + productData[input.productId].icon} />
              <span className="flex-8 justify-self-end-safe text-right">{amount}</span>
            </MenuButton>
            <MenuItems anchor="bottom start" className="bg-gray-800 border-1 border-gray-600 rounded-sm shadow-xl">
              {inputsMenuOptions.map(m =>
                <MenuItem key={"input-menu-"+m.label} onClick={m.onClick(input)} as="button" className="p-2 px-4 w-full text-center block border-b-1 border-gray-600 cursor-pointer data-focus:bg-blue-900">
                  {m.label}
                </MenuItem>
              )}
            </MenuItems>
          </Menu>
        })}
      </div>
      <div className="subtitle justify-self-end-safe">Manifolds</div>
      <div className="bg-gray-800 flex-1 p-1 items-end-safe justify-self-end-safe justify-end-safe">
        {manifolds?.map(m => {
          if (!m) return;

          return <div key={"manifold-"+m.id} className="cursor-pointer my-1 border-2 rounded-sm border-gray-700 p-1" onClick={()=>toggleFreed(m.constraintId)}>
            <div className="flex flex-row gap-1 align-middle justify-between">
              <div className="w-[40%] flex flex-wrap gap-1">
                {Array.from(m.inputs).map(i => <div key={"manifold-input-"+i.id}>
                  <img className="w-4" src={'/assets/products/' + i.icon} title={i.name} />
                </div>
                )}
              </div>
              <div className="flex w-[20%] text-center align-middle justify-center-safe">
                <img className="h-8" src={'/assets/products/' + m.icon} title={m.name} />
              </div>
              <div className="flex w-[40%] flex-wrap gap-1 justify-end-safe">
                {Array.from(m.outputs).map(i => <div key={"manifold-output-"+i.id}>
                  <img className="w-4" src={'/assets/products/' + i.icon} title={i.name} />
                </div>
                )}
              </div>
            </div>
            {m.flexible == false ? "" : (
              <div className="flex text-xs">
                <Field className="flex-1 text-right">
                  <Checkbox name="flexible" />
                  <Label className="">Flexible</Label>
                </Field>
                <span className="flex-1 justify-self-end text-right">{m.amount}</span>
              </div>
            )}
          </div>
        })}

      </div>


      <button className="h-10 py-1 w-20 mx-auto my-4 block bg-blue-500 cursor-pointer" onClick={recalc}><ArrowPathIcon className="mx-auto h-full" /></button>
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
              ><img src={'/assets/products/' + item.icon} title={item.name} className="inline-block p-2" />
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
          <Field className="flex-1 justify-around gap-2" key={"goal-type-"+r[1]}>
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
