import { expect, type Page, type Locator } from '@playwright/test';

/**
 * Wait for the sidebar goal list to reach a specific count.
 */
export async function waitForGoalCount(page: Page, count: number, timeout = 3000) {
  await expect(page.getByTestId('sidebar-goals-list').locator('.output-goal')).toHaveCount(
    count,
    { timeout }
  );
}

/**
 * Open the goal dialog for a product and fill in the quantity. Returns the
 * dialog locator so callers can interact with it (e.g. the "also add a
 * producer/consumer" checkbox) before saving.
 */
async function openGoalDialog(page: Page, productName: string, qty: number): Promise<Locator> {
  const goalList = page.getByTestId('sidebar-goals-list');

  // Click "Add Goal" button in the goals list to open product selector
  await goalList.getByRole('button', { name: 'Add Goal' }).click();

  // Wait for the product search input to be visible (dialog may animate in)
  const searchInput = page.getByPlaceholder('Search Products...');
  await searchInput.waitFor({ state: 'visible', timeout: 5000 });

  // Search for the product
  await searchInput.fill(productName);

  // Click the first matching product button (may be in icon or list mode)
  // Use exact title match to avoid matching "Copper ore" when searching "Copper"
  const productButton = page.locator(`button:has(img[title="${productName}" i])`).first();
  await productButton.waitFor({ state: 'visible', timeout: 5000 });
  await productButton.click();

  // Goal editor dialog appears — wait for the qty input (scoped to dialog to avoid
  // matching the inline qty input already present in the sidebar goal card)
  const dialog = page.locator('dialog, [role="dialog"]').last();
  const qtyInput = dialog.locator('input[name="qty"]');
  await qtyInput.waitFor({ state: 'visible' });

  // Set the quantity
  await qtyInput.fill(String(qty));

  return dialog;
}

/** Set the "also add a producer/consumer" checkbox to the desired state. */
async function setAddRecipeCheckbox(dialog: Locator, checked: boolean) {
  const box = dialog.locator('.addRecipeWithGoal');
  const isChecked = (await box.getAttribute('aria-checked')) === 'true';
  if (isChecked !== checked) {
    await box.click();
  }
}

/**
 * Add a goal via the sidebar goal dialog, without placing any recipe.
 * New goals default the "also add a producer/consumer" box to ticked, so we
 * untick it here to preserve this helper's "just add a goal" contract.
 */
export async function addGoal(page: Page, productName: string, qty: number) {
  const goalList = page.getByTestId('sidebar-goals-list');
  const dialog = await openGoalDialog(page, productName, qty);

  await setAddRecipeCheckbox(dialog, false);

  // Save the goal
  await dialog.locator('button.addItemAsGoal').click();

  // Wait for this product's goal card to be visible — avoids count-delta races
  // with async IndexedDB hydration restoring pre-existing goals simultaneously.
  await expect(
    goalList.locator(`.output-goal:has-text("${productName}")`)
  ).toBeVisible({ timeout: 5000 });
}

/**
 * Add a goal AND trigger the "also add a producer/consumer" flow via the goal
 * dialog checkbox (ticked by default for new goals). Does not wait for a result
 * — the caller asserts whether a node was auto-placed (single recipe) or the
 * recipe picker opened (multiple recipes).
 */
export async function addGoalWithRecipe(page: Page, productName: string, qty: number) {
  const dialog = await openGoalDialog(page, productName, qty);

  await setAddRecipeCheckbox(dialog, true);

  await dialog.locator('button.addItemAsGoal').click();
}

/**
 * Add a producer for a goal via its hamburger menu.
 * Assumes the goal is already visible in the sidebar.
 */
export async function addProducerFromGoal(page: Page, goalIndex: number) {
  // Click the hamburger (Bars3Icon) inside the goal card to open its popover menu
  const goalCard = page.getByTestId('sidebar-goals-list').locator('.output-goal').nth(goalIndex);
  await goalCard.locator('div.cursor-pointer').click();

  // Click "Add Producer"
  const menuItem = page.locator('button', { hasText: 'Add Producer' });
  await menuItem.waitFor({ state: 'visible' });
  await menuItem.click();
}
