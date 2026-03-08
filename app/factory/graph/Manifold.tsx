import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { ExclamationTriangleIcon, LockClosedIcon, LockOpenIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { useShallow } from "zustand/shallow";
import useFactory, { useFactoryStore } from "../../context/FactoryContext";
import type { Constraint } from "../solver/types";
import { loadData, type Product } from "./loadJsonData";
import { formatNumber, productIcon } from "~/uiUtils";
import { getRecipeInputs, getRecipeOutputs } from "~/gameData/utils";

type ManifoldProps = {
  manifoldId: string
}

type ManifoldRender = Product & {
  amount?: number;
  flexible: boolean;
  children: Array<{
    inputs: Set<Product>;
    outputs: Set<Product>;
    constraint: Constraint;
    freed: boolean;
  }>;
  parent: {
    inputs: Set<Product>;
    outputs: Set<Product>;
  };
  constraintId: string;
}

const {products} = loadData();

export default function Manifold(props: ManifoldProps) {
  const m = props.manifoldId;

  const model = useFactoryStore(useShallow(state => state.graph));
  // This isn't reactive, but it doesn't need to be, the manifolds will be recalculated whenever edges change
  const allEdges = useFactory().store.getState().edges;
  const solution = useFactoryStore(useShallow(state => state.solution));
  const manifoldOptions = useFactoryStore(useShallow(state => state.manifoldOptions));
  const setManifoldFree = useFactoryStore(useShallow(state => state.setManifold));
  const setEdgeData = useFactoryStore(useShallow(state => state.setEdgeData));
  
  const [childrenOpen, setChildrenOpen] = useState(false);
  const constraint = model?.constraints[m];
  const amount = solution?.manifolds?.[m];

  if (!constraint) {
    console.error('Constraint not found for manifold', m);
    return;
  }

  const mapConstraint = (edges: string[]) => {
    const inputs: Set<Product> = new Set();
    const outputs: Set<Product> = new Set();
    edges.forEach(e => {
      const edge = allEdges.find(x => x.id == e);
      if (!edge) return
      
      const sourceInputs = getRecipeInputs(model.graph[edge.source].recipeId);
      const targetOutputs = getRecipeOutputs(model.graph[edge.target].recipeId);
      
      sourceInputs.forEach(p => inputs.add(p));
      targetOutputs.forEach(p => outputs.add(p));
    });
    return { inputs, outputs }
  }
  const parent = mapConstraint(Object.keys(constraint.edges));
  if (parent.inputs.size == 0 || parent.outputs.size == 0) return;

  let freed = 0;
  const children = constraint.children.map(c => {
    const childConstraint = model.constraints[c];
    if (!childConstraint) return null;
    const childEdges = Object.keys(childConstraint.edges);
    const free = manifoldOptions.find(m => m.constraintId == c)?.free || false;

    if (free) freed++;
    return {
      ...mapConstraint(childEdges),
      constraint: childConstraint,
      freed: free,
    }
  }).filter(c => c !== null);

  if (manifoldOptions.find(man => man.constraintId == m)?.free === true)
    freed++;

  let unlocked: "some" | "all" | "none" = "none";
  if (freed > constraint.children.length)
    unlocked = "all";
  else if (freed > 0)
    unlocked = "some";

  const mani: ManifoldRender = {
    amount: amount,
    flexible: freed > 0,
    ...products.get(constraint.productId)!,
    parent,
    children,
    constraintId: m,
  }

  const mouseEnter = (edgesList: Constraint["edges"]) => {
    Object.keys(edgesList).forEach(e => setEdgeData(e, {
      highlight: true,
    }));
  }
  const mouseLeave = (edgesList: Constraint["edges"]) => {
    Object.keys(edgesList).forEach(e => setEdgeData(e, {
      highlight: false
    }));
  }

  const isOver = mani.flexible && mani.amount !== undefined && mani.amount > 0;
  const isUnder = mani.flexible && mani.amount !== undefined && mani.amount < 0;
  return <div

    key={"manifold-" + mani.id}
    data-isover={isOver || null}
    data-isunder={isUnder || null}
    className="flex flex-col my-1 gap-2 border-1 border-gray-700 rounded bg-gray-800 p-1"
  >
    <div
      className="summary flex flex-row h-8 pb-1"
      onMouseEnter={() => mouseEnter(constraint.edges)}
      onMouseLeave={() => mouseLeave(constraint.edges)}
    >
      <div className="w-[45%] flex gap-1 content-center-safe align-middle items-center-safe">
        <img className="h-full " src={productIcon(mani.icon)} title={mani.name} />
        {(isOver || isUnder) ? <ExclamationTriangleIcon className="inline-block h-[70%] text-rose-400" /> : ''}

      </div>
      <div className="lockAll w-[10%] flex content-center-safe align-middle items-center-safe justify-center">
        <ConstraintLockIcon onClick={() => setManifoldFree([constraint, ...children.map(c => c.constraint)], !freed)} unlocked={unlocked} />

      </div>
      <div className="w-[45%] h-5 justify-self-end-safe text-right">
        <span className="">{mani.flexible && mani.amount !== undefined ? (isOver ? "+" : "") + formatNumber(mani.amount, mani.unit) : ''}</span>
      </div>
    </div>
    <div
      className="
        allItems 
        grid grid-rows-[1fr] data-isopen:grid-rows-[0fr] 
        border-t-1 border-gray-700 data-isopen:border-t-0
        data-isopen:-mt-4 pt-2
        transition-[grid-template-rows_margin-top] duration-300 ease-in-out

      "
      data-isopen={childrenOpen || null}
      onMouseEnter={() => mouseEnter(constraint.edges)}
      onMouseLeave={() => mouseLeave(constraint.edges)}
    ><div className="overflow-hidden flex flex-row gap-1 align-middle justify-between">
        <div className="w-[45%] flex flex-wrap gap-1 content-center-safe">
          {Array.from(mani.parent.inputs).map(i => <div key={"manifold-input-" + i.id}>
            <img className="w-4" src={productIcon(i.icon)} title={i.name} />
          </div>
          )}
        </div>
        <div className="flex w-[10%] justify-center-safe">
          {mani.flexible ?
            <LockOpenIcon className="w-4 text-emerald-600" />
            :
            <LockClosedIcon className=" w-4 text-gray-500 " />
          }
        </div>
        <div className="flex w-[45%] flex-wrap gap-1 justify-end-safe content-center-safe">
          {Array.from(mani.parent.outputs).map(i => <div key={"manifold-output-" + i.id}>
            <img className="w-4" src={productIcon(i.icon)} title={i.name} />
          </div>
          )}
        </div>
      </div>
    </div>
    {children.length > 0 ? (<>
      <div data-isopen={childrenOpen || null} className="
        children invisible data-isopen:visible 
        grid grid-rows-[0fr] data-isopen:grid-rows-[1fr] 
        -mt-2 data-isopen:mt-0
        transition-[grid-template-rows] duration-300 ease-in-out">
        <div className="flex flex-col gap-2 overflow-hidden">
          {mani.children.map(c => {
            return <div
              onMouseEnter={() => mouseEnter(c.constraint.edges)}
              onMouseLeave={() => mouseLeave(c.constraint.edges)}
              key={"manifold-child-" + c.constraint.id}
              className="flex flex-row gap-1 align-middle justify-between border-t-1 border-dashed pt-2 border-gray-700"
            >
              <div className="w-[45%] flex flex-wrap gap-1 content-center-safe">
                {Array.from(c.inputs).map(i => <div key={"manifold-input-" + i.id}>
                  <img className="w-4" src={productIcon(i.icon)} title={i.name} />
                </div>
                )}
              </div>
              <div className="flex w-[10%]">
                <ConstraintLockIcon onClick={() => setManifoldFree([c.constraint, constraint], !c.freed)} unlocked={c.freed ? "all" : "none"} />
              </div>
              <div className="flex w-[45%] flex-wrap gap-1 justify-end-safe content-center-safe">
                {Array.from(c.outputs).map(i => <div key={"manifold-output-" + i.id}>
                  <img className="w-4" src={productIcon(i.icon)} title={i.name} />
                </div>
                )}
              </div>
            </div>
          })}
        </div>
      </div>

      <div className="flex justify-center items-center gap-1 cursor-pointer 
      text-gray-500 hover:text-gray-300 transition-colors duration-100"
          onClick={() => setChildrenOpen(!childrenOpen)}
      >
        <button
          className="flex-1 max-w-4 "
        >
          {childrenOpen ? <ChevronUpIcon strokeWidth={3.5} /> : <ChevronDownIcon strokeWidth={3.5} />}
        </button>
      </div>
    </>) : ""}

  </div>

}

function ConstraintLockIcon(props: {
  unlocked: "all" | "none" | "some";
  onClick?: () => void;
}) {
  return <div className="h-6 bg-zinc-900 border-b-2 border-zinc-700 
            content-center-safe align-middle items-center-safe
            rounded-xl box-border cursor-pointer inline-block p-1
            active:brightness-60 ml-auto mr-auto
            transition-[filter] duration-100 hover:brightness-140"
    title={props.unlocked == "none" ? "Temporarily allow import/export" : "Disallow import/export"}
    onClick={props.onClick}
  >
    {props.unlocked == "none" ?
      <LockClosedIcon className="h-full text-gray-500 " />
      :
      <LockOpenIcon data-child-free={props.unlocked == "some" || null} className="h-full data-child-free:text-amber-600 text-emerald-600" />
    }
  </div>
}
