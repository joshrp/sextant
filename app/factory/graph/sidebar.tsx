import { Button, Field, Fieldset, Input, Label, Radio, RadioGroup } from '@headlessui/react';
import { ClockIcon, PlusIcon } from '@heroicons/react/24/solid';
import { useCallback, useState, type ChangeEvent } from 'react';

import { SelectorDialog } from 'app/components/Dialog';
import { SidebarPopover, PopoverMenuItem, PopoverIconActions, PopoverIconAction } from '~/components/SidebarPopover';
import { useShallow } from 'zustand/shallow';
import ProductSelector from '~/components/ProductSelector';
import useFactory, { useFactoryStore } from '~/factory/FactoryContext';
import { formatNumber, productBackground, productIcon } from '~/uiUtils';
import type { AddRecipeNode } from '../factory';
import type { FactoryGoal } from '../solver/types';
import { loadData, type Product, type ProductId } from './loadJsonData';
import Manifold from './Manifold';
import { EyeIcon } from '@heroicons/react/24/outline';
import EmptyStateCard from '~/components/EmptyStateCard';
import HelpLink from '~/components/HelpLink';

const productData = loadData()?.products;

type props = {
  addNewRecipe: (addRecipeNode: AddRecipeNode) => void
};

const icons = {
  "gt": "\u2265",
  "lt": "\u2264",
  "eq": "\u003D"
}

// TODO: Component Testing - This component is complex and needs refactoring for testability:
// 1. Extract goal management logic (addGoal, editGoal, removeGoal) into a custom hook or reducer
// 2. Extract manifold filtering logic into a pure function
// 3. Separate presentation from state management - create smaller sub-components for:
//    - GoalsList component (displaying and editing goals)
//    - ManifoldsList component (displaying manifolds)
//    - SolutionSummary component (displaying solution results)
// 4. Move menu configuration (goalsMenuOptions, inputsMenuOptions) to constants/config
// 5. Add unit tests for extracted logic functions
// 6. Add component tests for sub-components with mocked store
function SideBar({ addNewRecipe }: props) {

  const store = useFactory().store;

  const solution = useFactoryStore(useShallow(state => state.solution));
  const goals = useFactoryStore(useShallow(state => state.goals));
  const model = useFactoryStore(useShallow(state => state.graph));
  const solutionUpdateAction = useFactoryStore(useShallow(state => state.solutionUpdateAction));
  const setHighlight = useFactoryStore(useShallow(state => state.setHighlight));
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

  const editGoalFor = useCallback((product: Product) => {
    setEditGoal({
      dir: "output",
      type: "eq",
      productId: product.id,
      qty: 10
    });
  }, [setEditGoal]);

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
      position: { x: 0, y: 0 },
      otherNode: "",
    }),
  }]
  const inputsMenuOptions = [{
    label: "Add Producer",
    onClick: <T extends { productId: ProductId }>(input: T) => () => addNewRecipe({
      productId: input.productId,
      produce: true,
      position: { x: 0, y: 0 },
      otherNode: "",
    }),
  }];
  const byProductsMenuOptions = [{
    label: "Add as Goal",
    onClick: <T extends { productId: ProductId }>(output: T) => () => {
      setEditGoal({
        dir: "output",
        type: "eq",
        productId: output.productId,
        qty: 10
      });
    }
  }, {
    label: "Add Consumer",
    onClick: <T extends { productId: ProductId }>(output: T) => () => addNewRecipe({
      productId: output.productId,
      produce: false,
      position: { x: 0, y: 0 },
      otherNode: "",
    }),
  }];

  return (<>
    <div className='sidebar flex flex-col p-2 h-full justify-start'>
      <div className="title flex items-center justify-between">
        <span>Goals</span>
        <HelpLink topic="goals" title="Learn about Goals" />
      </div>
      <div className="goals" data-testid="sidebar-goals-list">
        {goals.length === 0 && (
          <EmptyStateCard text="What do you want to produce? Click + to get started" />
        )}
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
          return <SidebarPopover
            key={"goal-" + i}
            trigger={
              <div className={`output-goal w-full gap-2 p-2 flex my-1
                                  hover:bg-gray-900
                                    rounded cursor-pointer 
                                    border-1 border-gray-500  text-xs 
                                    ${fulfilled ? "bg-green-900" : "bg-red-900"}
                                    `}
              >
                <ProductGoal goal={goal} resultCount={resultCount} />
              </div>
            }
            anchor="bottom end"
          >
            {goalsMenuOptions.map(m =>
              <PopoverMenuItem key={"goal-item-" + m.label} onClick={m.onClick(goal)}>
                {m.label}
              </PopoverMenuItem>
            )}
          </SidebarPopover>
        })}
        <button onClick={() => setSelectProductDialog(true)} className="cursor-pointer bg-gray-700 rounded hover:bg-gray-900 focus:bg-gray-900 active:bg-gray-900 ">
          <div className="inline-flex text-center w-8 align-middle">
            <PlusIcon />
          </div>
        </button>

      </div>
      <div className="subtitle mt-4">By Products</div>

      <div className="byproducts grid grid-cols-2 gap-2" data-testid="sidebar-byproducts-list">
        {!solution?.products?.outputs?.length && (
          <div className="col-span-2">
            <EmptyStateCard text="By-products appear here once you add recipes" />
          </div>
        )}
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

          return <SidebarPopover
            key={"output-" + i}
            trigger={
              <div
                style={{ backgroundColor: productBackground(product) }}
                className={`output-goal flex justify-between items-center-safe w-full px-2 py-1 
                          h-8 rounded cursor-pointer
                          hover:brightness-110  
                          ${isSurplus ? "bg-green-900" : ""}`}
              >
                <img className="h-full " src={productIcon(product.icon)} />
                <span className="flex-8 text-right text-sm ">{formatNumber(amount, product.unit)}</span>
              </div>
            }
            anchor="bottom start"
          >
            {byProductsMenuOptions.map(m =>
              <> <PopoverMenuItem key={"byproduct-menu-" + m.label} onClick={m.onClick(output)}>
                {m.label}
              </PopoverMenuItem>
              </>
            )}
          </SidebarPopover>
        })}
      </div>
      <div className="subtitle mt-4">Inputs</div>
      <div className="inputs-list grid grid-cols-2 gap-2 mb-2 bg-gray-800 rounded" data-testid="sidebar-inputs-list">
        {!solution?.products?.inputs?.length && (
          <div className="col-span-2">
            <EmptyStateCard text="Required inputs will show here after adding recipes" />
          </div>
        )}
        {solution?.products?.inputs.map((input, i) => {
          const product = productData.get(input.productId);
          if (!product) {
            console.warn("Product not found for input", input);
            return null;
          }
          const amount = input.amount * -1;
          if (amount <= 0) return;
          return <SidebarPopover
            key={"input-" + i}
            trigger={
              <div
                style={{ backgroundColor: productBackground(product) }}
                className={`input-goal flex justify-between items-center-safe w-full px-2 py-1  
                          h-8 rounded cursor-pointer
                          hover:brightness-110`}
              >
                <img className="h-full drop-shadow-md/30 " src={productIcon(product.icon)} />
                <span className="flex-8 text-right text-sm text-shadow-lg">{formatNumber(amount, product.unit)}</span>
              </div>
            }
            anchor="bottom start"
          >
            {inputsMenuOptions.map(m =>
              <PopoverMenuItem key={"input-menu-" + m.label} onClick={m.onClick(input)}>
                {m.label}
              </PopoverMenuItem>
            )}
            <PopoverIconActions>
              <PopoverIconAction Icon={EyeIcon} label="Show Uses" onClick={() => {
                setHighlight({ mode: 'product', productId: input.productId, options: { inputs: true, outputs: true } });
              }} />
            </PopoverIconActions>
          </SidebarPopover>

        })}
      </div>
      <div className="subtitle justify-self-end-safe mt-auto flex items-center justify-between">
        <span>Manifolds</span>
        <HelpLink topic="manifolds" title="Learn about Manifolds" />
      </div>
      <div className="justify-self-end-safe">
        {manifolds?.map((m, i) => {
          if (!m) return;

          return <Manifold key={"manifold-" + i} manifoldId={m} />
        })}

      </div>
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addGoal(goalData);
    }
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
        <Input 
          value={goalData.qty} 
          onChange={updateState} 
          onKeyDown={handleKeyDown}
          className="bg-gray-600 p-1 w-[6rem]" 
          name="qty" 
          type="number" 
          placeholder="50" 
        />
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

export function ProductGoal({ goal, resultCount }: { goal: FactoryGoal, resultCount?: number }) {
  const product = productData.get(goal.productId);
  if (!product) return null;

  return <>
    <div className="flex-1 max-w-10 justify-self-start">
      <img className="w-full" src={productIcon(product.icon)} />
    </div>
    <div className="flex-3 content-center-safe">{icons[goal.type]} {formatNumber(goal.qty, product.unit)}</div>
    <div className="verticalRule self-stretch w-0.5 bg-neutral-500 opacity-50"></div>
    <div className="w-full flex-2 content-center-safe justify-self-end-safe text-right text-nowrap">
      {resultCount ? formatNumber(resultCount, product.unit) : ''}
    </div>
  </>;
}

export default SideBar;
