import { Button, Field, Fieldset, Input, Label, Radio, RadioGroup } from '@headlessui/react';
import { Bars3Icon, ClockIcon, ExclamationTriangleIcon, PlusIcon } from '@heroicons/react/24/solid';
import { useCallback, useEffect, useState, type ChangeEvent } from 'react';

import { SelectorDialog } from 'app/components/Dialog';
import { SidebarPopover, PopoverMenuItem, PopoverIconActions, PopoverIconAction } from '~/components/SidebarPopover';
import { useShallow } from 'zustand/shallow';
import ProductSelector from '~/components/ProductSelector';
import useFactory, { useFactoryStore } from '~/context/FactoryContext';
import { formatNumber, productBackground, productIcon } from '~/uiUtils';
import type { AddRecipeNode } from '../factory';
import type { FactoryGoal } from '../solver/types';
import type { GoalError } from '../solver/types';
import { loadData, type Product, type ProductId } from './loadJsonData';
import Manifold from './Manifold';
import { EyeIcon } from '@heroicons/react/24/outline';
import EmptyStateCard from '~/components/EmptyStateCard';
import HelpLink from '~/components/HelpLink';

const productData = loadData()?.products;

type props = {
  addNewRecipe: (addRecipeNode: AddRecipeNode) => void
};

// TODO: Component Testing - This component is complex and needs refactoring for testability:
// 1. Extract goal management logic (addGoal, editGoal, removeGoal) into a custom hook or reducer
// 2. Extract manifold filtering logic into a pure function
// 3. Separate presentation from state management - create smaller sub-components
// 4. Add unit tests for extracted logic functions
// 5. Add component tests for sub-components with mocked store

type GoalCardProps = {
  goal: FactoryGoal;
  resultCount?: number;
  error?: GoalError;
  onUpdate: (goal: FactoryGoal) => void;
  onEdit: () => void;
  onRemove: () => void;
  onAddProducer: () => void;
};

function GoalCard({ goal, resultCount, error, onUpdate, onEdit, onRemove, onAddProducer }: GoalCardProps) {
  const product = productData.get(goal.productId);
  if (!product) return null;

  // Magnitude only — no sign. Direction is tracked separately so the dropdown stays stable.
  const [rawInput, setRawInput] = useState(goal.qty === 0 ? '' : String(Math.abs(goal.qty)));
  const [isInput, setIsInput] = useState(goal.qty < 0);

  // Sync when goal changes externally (e.g. after full-edit dialog)
  useEffect(() => {
    setRawInput(goal.qty === 0 ? '' : String(Math.abs(goal.qty)));
    setIsInput(goal.qty < 0);
  }, [goal.qty]);

  let fulfilled = false;
  if (resultCount !== undefined) {
    if (goal.type === "eq") fulfilled = goal.qty === resultCount;
    else if (goal.type === "lt") fulfilled = goal.qty >= resultCount;
    else if (goal.type === "gt") fulfilled = goal.qty <= resultCount;
  }

  // Direction dropdown — commits immediately
  const handleDirectionChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const wantInput = e.target.value === 'use';
    setIsInput(wantInput);
    const val = parseFloat(rawInput);
    if (!isNaN(val)) onUpdate({ ...goal, qty: wantInput ? -val : val });
  };

  // Type dropdown — commits immediately. Option values are always the stored type;
  // the labels flip in Use mode so e.target.value is already correct.
  const handleTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onUpdate({ ...goal, type: e.target.value as FactoryGoal['type'] });
  };

  // Qty input: typing a leading '-' flips direction to Use and strips the sign
  const handleQtyChange = (e: ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    if (raw.startsWith('-')) {
      setIsInput(true);
      raw = raw.slice(1);
    }
    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return;
    setRawInput(raw);
  };

  const commitQty = () => {
    const val = parseFloat(rawInput);
    if (!isNaN(val) && val >= 0) {
      onUpdate({ ...goal, qty: isInput ? -val : val });
    } else {
      // Revert to last committed value
      setRawInput(goal.qty === 0 ? '' : String(Math.abs(goal.qty)));
      setIsInput(goal.qty < 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitQty(); }
  };

  const selectCls = "bg-gray-700/60 border border-gray-600/50 rounded px-1.5 py-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400";

  return (
    <div
      data-goal-error={error ? "true" : undefined}
      data-goal-fulfilled={fulfilled ? "true" : undefined}
      className="output-goal w-full my-1 rounded border border-gray-600 text-xs bg-gray-800 overflow-hidden"
    >
      {/* Row 1: icon + name + hamburger menu */}
      <div className="flex items-center justify-between gap-1 px-2 pt-2 pb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <img className="h-5 w-5 shrink-0" src={productIcon(product.icon)} />
          <span className="truncate font-medium">{product.name}</span>
          {product.unit && (
            <span className="text-gray-400 shrink-0">{product.unit}</span>
          )}
        </div>
        <SidebarPopover
          trigger={<Bars3Icon className="w-6 shrink opacity-50 hover:opacity-100 cursor-pointer" />}
          anchor="bottom end"
        >
          <PopoverMenuItem onClick={onEdit}>Edit</PopoverMenuItem>
          <PopoverMenuItem onClick={onRemove}>Remove</PopoverMenuItem>
          <PopoverMenuItem onClick={onAddProducer}>Add Producer</PopoverMenuItem>
        </SidebarPopover>
      </div>

      {/* Row 2: direction select + type select + qty input */}
      <div className="flex items-center gap-1.5 px-2 pb-2">
        <select
          value={isInput ? 'use' : 'produce'}
          onChange={handleDirectionChange}
          className={`${selectCls} ${isInput ? 'text-blue-300' : 'text-green-300'} shrink-0`}
        >
          <option value="produce">Produce</option>
          <option value="use">Use</option>
        </select>
        <select
          value={goal.type}
          onChange={handleTypeChange}
          className={`${selectCls} text-gray-200 grow`}
        >
          <option value="gt">{isInput ? 'at most' : 'at least'}</option>
          <option value="eq">exactly</option>
          <option value="lt">{isInput ? 'at least' : 'at most'}</option>
        </select>
        <div className="flex items-center gap-1 shrink-0">
          <input
            value={rawInput}
            onChange={handleQtyChange}
            onBlur={commitQty}
            onKeyDown={handleKeyDown}
            className={`${selectCls} w-16 text-right`}
            name="qty"
            type="text"
            inputMode="numeric"
            placeholder="0"
          />
        </div>
      </div>

      {/* Row 3: result strip — coloured to reflect status */}
      {(resultCount !== undefined || error) && (
        <div className={`flex items-center justify-end gap-1 px-2 py-1 border-t border-gray-600/50
          ${error ? 'bg-zinc-700 text-gray-300' : fulfilled ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
          {error ? (
            <div className="flex items-center gap-1 text-red-400" title={error.message}>
              <ExclamationTriangleIcon className="w-3.5 h-3.5" />
              <span>Conflict</span>
            </div>
          ) : (
            <div className="flex items-baseline w-full gap-2">
              <span className="text-xs opacity-70">{resultCount! >= 0 ? 'Produces' : 'Consumes'}</span>
              <span className="flex-1 text-center text-sm font-semibold">{formatNumber(Math.abs(resultCount!), product.unit)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SideBar({ addNewRecipe }: props) {

  const store = useFactory().store;

  const solution = useFactoryStore(useShallow(state => state.solution));
  const goals = useFactoryStore(useShallow(state => state.goals));
  const goalErrors = useFactoryStore(useShallow(state => state.goalErrors));
  const model = useFactoryStore(useShallow(state => state.graph));
  const solutionUpdateAction = useFactoryStore(useShallow(state => state.solutionUpdateAction));
  const setHighlight = useFactoryStore(useShallow(state => state.setHighlight));
  const manifoldOptions = useFactoryStore(useShallow(state => state.manifoldOptions));
  const [editGoal, setEditGoal] = useState<FactoryGoal | null>(null);

  const addGoal = useCallback((goal: FactoryGoal): void => {
    const exists = goals.findIndex(g => goal.productId == g.productId);
    if (exists >= 0)
      store.setState(state => ({ goals: state.goals.map(g => g.productId === goal.productId ? goal : g) }), false, "Update existing goal in place");
    else
      store.setState(state => ({ goals: [...state.goals, goal] }), false, "Add new goal");
    solutionUpdateAction();

    setEditGoal(null);
    setSelectProductDialog(false);
  }, [goals, store]);

  const editGoalFor = useCallback((product: Product) => {
    setEditGoal({
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
      .sort((a, b) => {
        const aFreed = manifoldOptions.some(m => m.constraintId === a && m.free);
        const bFreed = manifoldOptions.some(m => m.constraintId === b && m.free);
        return (bFreed ? 1 : 0) - (aFreed ? 1 : 0);
      })
    : [];

  const [selectProductDialog, setSelectProductDialog] = useState(false);
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
        {goals.map((goal) => {
          const resultCount = solution?.goals?.find(g => g.goal.productId == goal.productId)?.resultCount;
          const goalError = goalErrors?.find((e: GoalError) => e.productId === goal.productId);
          return (
            <GoalCard
              key={"goal-" + goal.productId}
              goal={goal}
              resultCount={resultCount}
              error={goalError}
              onUpdate={addGoal}
              onEdit={() => setEditGoal(goal)}
              onRemove={() =>
                store.setState(state => ({ goals: state.goals.filter(c => c.productId !== goal.productId) }))
              }
              onAddProducer={() => addNewRecipe({
                productId: goal.productId,
                produce: true,
                position: { x: 0, y: 0 },
                otherNode: "",
              })}
            />
          );
        })}
        <button onClick={() => setSelectProductDialog(true)} className="cursor-pointer w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 rounded bg-gray-700 hover:bg-gray-600 active:bg-gray-900 text-xs text-gray-300">
          <PlusIcon className="w-3.5 h-3.5" />
          Add Goal
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
          const goal = goals.find(g => g.productId === output.productId);
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
  const [rawInput, setRawInput] = useState(goal.qty === 0 ? '' : String(goal.qty));

  // Derive direction reactively from the raw string — no separate isInput state
  const isInput = rawInput.startsWith('-');

  const updateQty = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Only allow digits, a leading minus, and a decimal point
    if (raw !== '' && raw !== '-' && !/^-?\d*\.?\d*$/.test(raw)) return;
    setRawInput(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      setGoalData(d => ({ ...d, qty: parsed }));
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitGoal();
    }
  }

  const toggleDirection = (input: boolean) => {
    setRawInput(prev => {
      if (input && !prev.startsWith('-')) return prev === '' ? '-' : '-' + prev;
      if (!input && prev.startsWith('-')) return prev.slice(1);
      return prev;
    });
    setGoalData(d => ({ ...d, qty: input ? -Math.abs(d.qty) : Math.abs(d.qty) }));
  }

  const submitGoal = () => {
    const qty = parseFloat(rawInput);
    addGoal({ ...goalData, qty: isNaN(qty) ? 0 : qty });
  }

  return <>
    <Fieldset className="w-full min-h-50 flex flex-col gap-4">
      <RadioGroup name="direction" value={isInput} onChange={toggleDirection} className="flex justify-stretch w-full gap-2">
        {([["Output", false], ["Input", true]] as const).map(([label, value]) => (
          <Field className="flex-1 justify-around gap-2" key={"goal-dir-" + label}>
            <Radio value={value} className="group block rounded border-1 data-checked:border-2 border-gray-700 data-checked:bg-teal-900 w-full h-full text-center p-1">
              <Label>{label}</Label>
            </Radio>
          </Field>
        ))}
      </RadioGroup>
      <RadioGroup name="type" value={goalData.type} onChange={v => setGoalData(d => ({ ...d, type: v }))} className="flex justify-stretch w-full gap-2">
        {[["Minimum of", "gt"], ["Exactly", "eq"], ["Maximum of", "lt"]].map(r => (
          <Field className="flex-1 justify-around gap-2" key={"goal-type-" + r[1]}>
            <Radio key={r[1]} value={r[1]} className="group block rounded border-1 data-checked:border-2 border-gray-700 data-checked:bg-teal-900 w-full h-full">
              <Label >{r[0] + " " + formatNumber(goalData.qty, productData.get(goalData.productId)!.unit)}</Label>
            </Radio>
          </Field>
        ))}
      </RadioGroup>
      <Field className="flex gap-2 justify-center align-middle">
        <Label className="p-1">Amount</Label>
        <Input
          value={rawInput}
          onChange={updateQty}
          onKeyDown={handleKeyDown}
          className="bg-gray-600 p-1 w-[6rem]"
          name="qty"
          type="text"
          inputMode="numeric"
          placeholder="50"
          autoFocus
        />
        <span className="text-xs mt-2 text-gray-400">
          60 <ClockIcon className="inline w-4 pb-1  text-gray-500" />
        </span>
      </Field>
      <Field>
        <Button onClick={submitGoal} className="addItemAsGoal p-2 px-8 cursor-pointer mt-8 hover:bg-gray-900 rounded bg-gray-700 border-2 border-gray-500">Save</Button>
      </Field>
    </Fieldset>
  </>
}

export function ProductGoal({ goal, resultCount, error }: { goal: FactoryGoal, resultCount?: number, error?: GoalError }) {
  const product = productData.get(goal.productId);
  if (!product) return null;

  return <>
    <div className="flex-1 max-w-10 justify-self-start">
      <img className="w-full" src={productIcon(product.icon)} />
    </div>
    <div className="flex-3 content-center-safe">{{ gt: "≥", lt: "≤", eq: "=" }[goal.type]} {formatNumber(goal.qty, product.unit)}</div>

    <div className="verticalRule self-stretch w-0.5 bg-neutral-500 opacity-50"></div>
    <div className="w-full flex-2 content-center-safe justify-self-end-safe text-right text-nowrap">
      {resultCount ? formatNumber(resultCount, product.unit) : ''}
      {error && (
        <div className="content-center-safe" title={error.message}>
          <ExclamationTriangleIcon className="w-6 text-red-400" />
        </div>
      )}
    </div>
  </>;
}

export default SideBar;
