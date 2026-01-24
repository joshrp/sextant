# Playwright E2E Testing Guide

This document covers the setup and usage of Playwright for end-to-end testing in the COI Calculator.

## Quick Start

```bash
# Install dependencies (if not already done)
npm ci

# Install Playwright browsers
npx playwright install chromium

# Build the app (required before running e2e tests)
npm run build

# Run e2e tests
npm run test:e2e
```

## Configuration

The Playwright configuration is in `playwright.config.ts`:

- **Test directory:** `./e2e`
- **Base URL:** `http://localhost:4173` (production build preview)
- **Browser:** Chromium only (add more browsers as needed)
- **Web Server:** Automatically starts `npm run preview` before tests

### Key Configuration Decisions

1. **Production build testing:** Tests run against `npm run preview` which serves the production build, ensuring tests validate what users will see.

2. **Chromium only:** Start with one browser for fast CI runs. Expand to Firefox/WebKit when stability is proven.

3. **Parallel execution:** Enabled (`fullyParallel: true`) since each test gets a fresh browser context and IndexedDB is isolated.

4. **CI-aware settings:**
   - Retries: 2 on CI, 0 locally
   - Reporter: GitHub Actions reporter on CI, HTML locally
   - Server reuse: Only locally (always fresh on CI)

## Running Tests

### Local Development

```bash
# Run all e2e tests
npm run test:e2e

# Run with visible browser
npm run test:e2e -- --headed

# Run specific test file
npm run test:e2e -- e2e/app.spec.ts

# Run with UI mode (interactive debugging)
npm run test:e2e -- --ui

# Generate test code by clicking in browser
npx playwright codegen http://localhost:4173
```

### Debugging

```bash
# Debug tests with step-through
npm run test:e2e -- --debug

# View HTML report after tests complete
npx playwright show-report

# View trace from failed test
npx playwright show-trace test-results/<test-name>/trace.zip
```

## Writing Tests

### Test Structure

Tests are in the `e2e/` directory:

```
e2e/
├── app.spec.ts          # Main app smoke tests
└── fixtures/            # Shared test helpers (future)
```

### Example Test

```typescript
import { test, expect } from '@playwright/test';

test.describe('Factory Planner App', () => {
  test('should display zone selector on load', async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    
    // Wait for redirect to zone
    await page.waitForURL(/\/zones\//, { timeout: 10000 });
    
    // Verify elements are visible
    await expect(page.getByRole('heading', { name: 'Factory Planner' })).toBeVisible();
    await expect(page.getByText('Goals', { exact: true })).toBeVisible();
  });
});
```

### Best Practices

1. **Wait for navigation:** The app redirects from `/` to `/zones/{zoneId}`, so wait for the URL pattern.

2. **Use semantic selectors:** Prefer `getByRole`, `getByText`, `getByLabel` over CSS selectors.

3. **Keep tests independent:** Each test should work without depending on state from other tests.

4. **Test what users see:** Focus on visible elements and user interactions, not implementation details.

## Docker & CI Integration

### Running in Docker

The app is client-side only, so you just need a container with:
- Node.js 20+
- Playwright browsers installed

```dockerfile
# Example Dockerfile for e2e tests
FROM mcr.microsoft.com/playwright:v1.57.0-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build app
RUN npm run build

# Run tests
CMD ["npm", "run", "test:e2e"]
```

Alternatively, use the official Playwright Docker image:

```bash
# Run tests in container
docker run -it --rm \
  -v $(pwd):/app \
  -w /app \
  mcr.microsoft.com/playwright:v1.57.0-jammy \
  bash -c "npm ci && npm run build && npm run test:e2e"
```

### GitHub Actions Workflow

Add this to `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      
      - name: Build app
        run: npm run build
      
      - name: Run e2e tests
        run: npm run test:e2e
      
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

### GitHub Copilot Agent

When running in a GitHub Copilot agent environment:

1. **Build first:** Always run `npm run build` before `npm run test:e2e`
2. **Install browsers:** Run `npx playwright install chromium` if browsers aren't cached
3. **Check screenshots on failure:** Screenshots are saved to `test-results/`
4. **Use headless mode:** The default configuration runs headless, suitable for agents

## Test Artifacts

After running tests, Playwright generates several artifacts:

- **`playwright-report/`** - HTML report (viewable with `npx playwright show-report`)
- **`test-results/`** - Contains screenshots, traces, and error context for failed tests

Both directories are in `.gitignore` to avoid committing artifacts.

## Troubleshooting

### Tests fail with "browser not found"

```bash
# Install browsers
npx playwright install chromium
```

### Tests timeout waiting for app

1. Ensure the build exists: `npm run build`
2. Manually test the preview: `npm run preview` then visit http://localhost:4173
3. Increase timeout in `playwright.config.ts` if needed

### IndexedDB issues between tests

Each test gets a fresh browser context, so IndexedDB should be isolated. If you see state leaking:
1. Ensure tests don't use `test.describe.serial()`
2. Add explicit cleanup: `await page.evaluate(() => indexedDB.deleteDatabase('planner-db'))`

### CI runs slower than local

This is expected. CI runners have less resources. Consider:
1. Using only chromium (already configured)
2. Increasing timeouts for slow operations
3. Running tests in parallel (already enabled)
