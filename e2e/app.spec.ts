import { test, expect } from '@playwright/test';

/**
 * Basic e2e tests to verify the app loads correctly with key UI elements.
 * These tests ensure the fundamental navigation and factory features are visible.
 * 
 * Note: For production-grade tests, consider adding data-testid attributes to key
 * components for more resilient selectors.
 */

test.describe('Factory Planner App', () => {
  test('should display zone selector and factory goals on initial load', async ({ page }) => {
    // Navigate to the app
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Wait for the app to load and redirect to a zone
    // The app auto-redirects from / to /zones/{zoneId}
    await page.waitForURL(/\/zones\//, { timeout: 1000 });

    // Verify the main header title is visible
    await expect(page.getByRole('heading', { name: 'Sextant - COI Planner' })).toBeVisible();
    
    // Verify the zone selector is present
    // The zone selector shows "Zone:" label followed by the current zone name
    await expect(page.getByRole('heading', { name: 'Zone:' })).toBeVisible();
    
    // Verify the zone dropdown button shows the default zone name
    const zoneMenuButton = page.locator('button').filter({ hasText: 'Default' });
    await expect(zoneMenuButton).toBeVisible();
    
    // Verify the Goals section is visible in the sidebar
    await expect(page.getByText('Goals', { exact: true })).toBeVisible();
    
    // Verify the By Products section is visible (part of the sidebar)
    await expect(page.getByText('By Products')).toBeVisible();
  });

  test('should display factory tabs in sidebar', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForURL(/\/zones\//, { timeout: 1000 });
    
    // Verify the sidebar aside element exists
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    
    // Verify there are list items in the sidebar (factory tabs)
    await expect(sidebar.locator('li')).toHaveCount(4, { timeout: 1000 });
    
    // Find and click the expand button (last button in sidebar)
    const expandButton = sidebar.locator('button').last();
    await expect(expandButton).toBeVisible();
    await expandButton.click();
    
    // Now Zone Hub text should be visible after sidebar expansion
    await expect(page.getByText('Zone Hub')).toBeVisible();
  });
});
