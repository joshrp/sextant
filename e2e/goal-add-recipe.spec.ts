import { test, expect } from '@playwright/test';
import { addGoalWithRecipe } from './helpers/goals';

/**
 * E2E tests for the "also add a producer/consumer" checkbox on goal creation.
 *
 * When the box is ticked on save (see resolveGoalRecipe), with a fresh factory
 * (empty graph, so no machine tier can be reused):
 *  - a product with a single recipe and one machine tier auto-places it and
 *    skips the picker;
 *  - a product with a single recipe spread across machine tiers opens the picker
 *    with that recipe's tiers already expanded, so the only choice (which tier)
 *    is immediate.
 */
test.describe('Add producer/consumer on goal creation', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('./zones/main/my-factory', { waitUntil: 'domcontentloaded' });
  });

  test('single-recipe product auto-places a node and skips the picker', async ({ page }) => {
    // Woodchips have exactly one producer (Shredding wood) besides the balancer.
    await addGoalWithRecipe(page, 'Woodchips', 10);

    // A recipe node is placed directly, without the picker appearing.
    await expect(page.locator('.react-flow__node')).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('tr.recipe-row')).toHaveCount(0);
    // The auto-placed node is highlighted (selected) so the user can spot it.
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(1);
  });

  test('single multi-tier recipe opens the picker with its tiers expanded', async ({ page }) => {
    // Gold ore crushed has one recipe on two machine tiers (Crusher / CrusherLarge).
    // With an empty graph, neither tier's machine is present, so the picker opens —
    // and because there's only one recipe, its tiers are expanded by default.
    await addGoalWithRecipe(page, 'Gold ore crushed', 10);

    // Three rows are visible without expanding anything — the balancer plus both
    // crushing tiers (Crusher + CrusherLarge); collapsed it would show only two.
    // Nothing is placed until the user picks a tier.
    await expect(page.locator('tr.recipe-row')).toHaveCount(3, { timeout: 5000 });
    await expect(page.locator('.react-flow__node')).toHaveCount(0);
  });
});
