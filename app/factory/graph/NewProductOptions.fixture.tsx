import { NewProductOptions } from './sidebar';
import type { FactoryGoal } from '../solver/types';
import type { ProductId } from './loadJsonData';

// Woodchips is a real product, so the unit/format lookups inside the component resolve.
const makeGoal = (qty: number): FactoryGoal => ({
  type: 'eq',
  productId: 'Product_Woodchips' as ProductId,
  qty,
});

// Negative qty selects the Input direction, which flips the checkbox label to
// "Also add a consumer". isNew controls whether the box starts ticked.
const createFixture = (qty: number, isNew: boolean) => (
  <div className="p-4 bg-gray-800 text-white w-[36rem]">
    <NewProductOptions goal={makeGoal(qty)} isNew={isNew} onSave={() => {}} />
  </div>
);

export default {
  'New goal — Output (producer, ticked)': () => createFixture(10, true),
  'New goal — Input (consumer, ticked)': () => createFixture(-10, true),
  'Editing existing goal (unticked)': () => createFixture(10, false),
};
