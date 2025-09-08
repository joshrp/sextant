import { Button, Field, Fieldset, Input, Label, Menu, MenuButton, MenuItem, MenuItems, Radio, RadioGroup } from '@headlessui/react';
import { ClockIcon, PlusIcon } from '@heroicons/react/24/solid';
import { useCallback, useState, type ChangeEvent } from 'react';

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { SelectorDialog } from 'app/components/Dialog';
import { useShallow } from 'zustand/shallow';
import ProductSelector from '~/components/ProductSelector';
import useFactory, { useFactoryStore } from '~/factory/FactoryContext';
import { formatNumber, productBackground, productIcon } from '~/uiUtils';
import type { AddRecipeNode } from '../factory';
import type { FactoryGoal } from '../solver/types';
import { loadData, type Product, type ProductId } from './loadJsonData';
import Manifold from './Manifold';

const productData = loadData()?.products;

type props = {
  addNewRecipe: (addRecipeNode: AddRecipeNode) => void
};

const icons = {
  "gt": "\u2265",
  "lt": "\u2264",
  "eq": "\u003D"
}

function SideBar({ addNewRecipe }: props) {

  const store = useFactory().store;

  const solution = useFactoryStore(useShallow(state => state.solution));
  const goals = useFactoryStore(useShallow(state => state.goals));
  const model = useFactoryStore(useShallow(state => state.graph));
  const graphUpdateAction = useFactoryStore(useShallow(state => state.graphUpdateAction));
  const solutionUpdateAction = useFactoryStore(useShallow(state => state.solutionUpdateAction));

  const [editGoal, setEditGoal] = useState<FactoryGoal | null>(null);

  const addGoal = useCallback((goal: FactoryGoal): void => {
    const exists = goals.findIndex(g => goal.productId == g.productId);
    if (exists >= 0)
      store.setState(state => ({ goals: [...state.goals.filter(g => g.productId != goal.productId), goal] }), false, "Remove existing goal before adding new one");
    else
      store.setState(state => ({ goals: [...state.goals, goal] }), false, "Add new goal");
    solutionUpdateAction();

    setEditGoal(null);
    setSelectProductDialog(false);
  }, [goals, store]);

  const editGoalFor = (product: Product) => {
    setEditGoal({
      dir: "output",
      type: "eq",
      productId: product.id,
      qty: 10
    });
  }

  // Any constrain that doesn't have a parent and isn't unconnected is a manifold in the UI
  const manifolds = model?.constraints
    ? Object.keys(model.constraints)
      .map(id => model.constraints[id])
      .filter(c => !c.parent && !c.unconnected)
      .map(c => c.id)
    : [];

  const [selectProductDialog, setSelectProductDialog] = useState(false);
  const goalsMenuOptions = [{
    label: "Edit",
    onClick: (c: FactoryGoal) => () => setEditGoal(c)
  }, {
    label: "Remove",
    onClick: (goal: FactoryGoal) => () => {
      // Filter for only constraints that don't match this product
      store.setState(state => ({
        goals: state.goals.filter(c => c.productId !== goal.productId || c.dir !== goal.dir)
      }));
    }
  }, {
    label: "Add Producer",
    onClick: (goal: FactoryGoal) => () => addNewRecipe({
      productId: goal.productId,
      produce: goal.dir == "output",
      position: { x: 0, y: 0 }, // TODO: Get a better position
      otherNode: "",
    }),
  }]
  const inputsMenuOptions = [{
    label: "Add Producer",
    onClick: <T extends { productId: ProductId }>(input: T) => () => addNewRecipe({
      productId: input.productId,
      produce: true,
      position: { x: 0, y: 0 }, // TODO: Get a better position
      otherNode: "",
    }),
  }];

  return (<>
    <div className='sidebar flex flex-col h-full p-2'>
      <div className="title">Goals</div>
      <div className="flex-1">
        {goals.map((goal, i) => {
          const resultCount = solution?.goals?.find(g => g.goal.productId == goal.productId && g.goal.dir == goal.dir)?.resultCount;
          const product = productData.get(goal.productId);
          if (!product) {
            console.warn("Product not found for goal", goal);
            return null;
          }
          let fulfilled = false;
          if (resultCount !== undefined) {
            if (goal.type == "eq")
              fulfilled = goal.qty == resultCount;
            else if (goal.type == "lt")
              fulfilled = goal.qty >= resultCount;
            else if (goal.type == "gt")
              fulfilled = goal.qty <= resultCount;
          }
          return <Menu key={"goal-" + i}>
            <MenuButton key={"goal-" + i} as="div" className={`output-goal w-full gap-2 p-2 flex my-1
                                  hover:bg-gray-900
                                    rounded cursor-pointer 
                                    border-1 border-gray-500  text-xs 
                                    ${fulfilled ? "bg-green-900" : "bg-red-900"}
                                    `}
            >
              <div className="flex-1 max-w-10 justify-self-start">
                <img className="w-full" src={productIcon(product.icon)} />
              </div>
              <div className="flex-3 content-center-safe">{icons[goal.type]} {formatNumber(goal.qty, product.unit)}</div>
              <div className="verticalRule self-stretch w-0.5 bg-neutral-500 opacity-50"></div>
              <div className="w-full flex-2 content-center-safe justify-self-end-safe text-right text-nowrap">
                {resultCount ? formatNumber(resultCount, product.unit) : ''}
              </div>
            </MenuButton>
            <MenuItems anchor="bottom" className="bg-gray-800 border-2 border-gray-500 rounded-sm shadow-lg -mt-2">
              {goalsMenuOptions.map(m =>
                <MenuItem key={"goal-item-" + m.label} onClick={m.onClick(goal)} as="button"
                  className="p-2 px-4 w-full block text-left border-b-1 border-gray-500 border-dotted cursor-pointer data-focus:bg-blue-900"
                >
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

      <div className="byproducts flex-1 grid grid-cols-2 gap-1 content-start">
        {solution?.products?.outputs.map((output, i) => {
          const goal = goals.find(g => g.productId === output.productId && g.dir == "output");
          const product = productData.get(output.productId);
          if (!product) {
            console.warn("Product not found for output", output);
            return null;
          }
          let amount = output.amount;
          let isSurplus = false;
          if (goal) {
            amount -= goal.qty;
            isSurplus = true;
          }
          if (amount <= 0) return;

          return <div key={"output-" + i}
            style={{ backgroundColor: productBackground(product) }}
            className={`"output-goal w-full p-1 flex h-8
                                hover:brightness-110
                                rounded cursor-pointer 
                                ${isSurplus ? "bg-green-900" : ""}`}>
            <img className="h-full justify-self-start" src={productIcon(product.icon)} />
            <span className="flex-8 justify-self-end-safe text-right text-sm content-center-safe">{formatNumber(amount, product.unit)}</span>
          </div>
        })}
      </div>
      <div className="subtitle">Inputs</div>
      <div className="flex-1 grid grid-cols-2 gap-1 content-start">
        {solution?.products?.inputs.map((input, i) => {
          const product = productData.get(input.productId);
          if (!product) {
            console.warn("Product not found for input", input);
            return null;
          }
          const amount = input.amount * -1;
          if (amount <= 0) return;
          return <Menu key={"input-" + i}>
            <MenuButton as="div"
              style={{ backgroundColor: productBackground(product) }}
              className={`"input-goal w-full p-1 flex h-8
                        hover:brightness-110
                        rounded cursor-pointer`}
            >
              <img className="h-full justify-self-start drop-shadow-md/30 " src={productIcon(product.icon)} />
              <span className="flex-8 justify-self-end-safe text-right text-sm text-shadow-lg content-center-safe">{formatNumber(amount, product.unit)}</span>
            </MenuButton>
            <MenuItems anchor="bottom start" className="bg-gray-800 border-1 border-gray-600 rounded-sm shadow-xl">
              {inputsMenuOptions.map(m =>
                <MenuItem key={"input-menu-" + m.label} onClick={m.onClick(input)} as="button" className="p-2 px-4 w-full text-center block border-b-1 border-gray-600 cursor-pointer data-focus:bg-blue-900">
                  {m.label}
                </MenuItem>
              )}
            </MenuItems>
          </Menu>
        })}
      </div>
      <div className="subtitle justify-self-end-safe">Manifolds</div>
      <div className="flex-1 items-end-safe justify-self-end-safe justify-end-safe">
        {manifolds?.map((m, i) => {
          if (!m) return;

          return <Manifold key={"manifold-" + i} manifoldId={m} />
        })}

      </div>
      <button className="h-8 py-1 w-20 mx-auto my-4 block bg-blue-500 cursor-pointer" onClick={graphUpdateAction}><ArrowPathIcon className="mx-auto h-full" /></button>
    </div>
    <ProductSelector
      products={productData}
      isOpen={selectProductDialog}
      setIsOpen={setSelectProductDialog}
      onSelect={editGoalFor}
    />
    {editGoal ? (
      <SelectorDialog
        title={"Change " + productData.get(editGoal.productId)?.name + " Goal"}
        isOpen={editGoal !== null}
        setIsOpen={() => setEditGoal(null)}
        widthClassName='min-w-140 max-w-[90vw]'
      >
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
    let newVal: number | string = e.target.value;
    if (e.target.type == "number") {
      newVal = parseFloat(newVal);
      if (isNaN(newVal as number)) newVal = 0;
    }
    setGoalData(d => ({ ...d, [prop]: newVal }));
  }

  return <>
    <Fieldset className="w-full min-h-50 flex flex-col gap-4">
      <RadioGroup name="type" value={goalData.type} onChange={v => setGoalData(d => ({ ...d, type: v }))} className="flex justify-stretch w-full gap-2">
        {[["Minimum of", "gt"], ["Exactly", "eq"], ["Maximum of", "lt"]].map(r => (
          <Field className="flex-1 justify-around gap-2" key={"goal-type-" + r[1]}>
            <Radio key={r[1]} value={r[1]} className="group block rounded border-1 data-checked:border-2 border-gray-700 data-checked:bg-teal-900 w-full h-full">
              <Label >{r[0] + " " + formatNumber(goalData.qty ?? 0, productData.get(goalData.productId)!.unit)}</Label>
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
