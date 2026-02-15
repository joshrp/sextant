import { test, expect, type Page } from '@playwright/test';
import { addGoal, addProducerFromGoal } from './helpers/goals';

/**
 * E2E tests for smart node placement from the sidebar.
 *
 * Verifies that nodes added via sidebar "Add Producer" buttons
 * are placed without overlapping existing nodes and within the
 * visible viewport.
 */

/** Bounding rect of a React Flow node in screen pixels. */
interface NodeRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const PADDING = 0; // tolerance pixels – only flag actual overlaps (placement algorithm enforces 20px padding)

/** Collect all React Flow node rects in flow-coordinate space (zoom-independent). */
async function getNodeRects(page: Page): Promise<NodeRect[]> {
  return page.evaluate(() => {
    // Get zoom scale from the viewport transform: translate(Xpx, Ypx) scale(S)
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewport) throw new Error('React Flow viewport not found');
    const vpTransform = viewport.style.transform;
    const scaleMatch = vpTransform.match(/scale\(([^)]+)\)/);
    const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;

    const nodes = document.querySelectorAll('.react-flow__node');
    return Array.from(nodes).map(node => {
      const el = node as HTMLElement;
      // Parse flow-space position from the node's transform: translate(Xpx, Ypx)
      const transform = el.style.transform;
      const translateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
      const flowX = translateMatch ? parseFloat(translateMatch[1]) : 0;
      const flowY = translateMatch ? parseFloat(translateMatch[2]) : 0;
      // Get dimensions in flow space by dividing screen size by zoom scale
      const rect = el.getBoundingClientRect();
      return {
        id: el.getAttribute('data-id') ?? el.getAttribute('data-testid') ?? '',
        x: flowX,
        y: flowY,
        width: rect.width / scale,
        height: rect.height / scale,
      };
    });
  });
}

/** Check whether two rects overlap (with padding tolerance). */
function rectsOverlap(a: NodeRect, b: NodeRect, padding: number): boolean {
  return !(
    a.x + a.width + padding <= b.x ||
    b.x + b.width + padding <= a.x ||
    a.y + a.height + padding <= b.y ||
    b.y + b.height + padding <= a.y
  );
}

/** Return all overlapping pairs from a list of rects. */
function findOverlaps(rects: NodeRect[], padding: number): Array<[string, string]> {
  const overlaps: Array<[string, string]> = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsOverlap(rects[i], rects[j], padding)) {
        overlaps.push([rects[i].id, rects[j].id]);
      }
    }
  }
  return overlaps;
}

/** Get the visible viewport bounds in flow-coordinate space. */
async function getContainerRect(page: Page) {
  return page.evaluate(() => {
    const container = document.querySelector('.react-flow');
    if (!container) throw new Error('React Flow container not found');
    const containerRect = container.getBoundingClientRect();

    // Parse viewport transform: translate(Xpx, Ypx) scale(S)
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewport) throw new Error('React Flow viewport not found');
    const vpTransform = viewport.style.transform;
    const translateMatch = vpTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
    const scaleMatch = vpTransform.match(/scale\(([^)]+)\)/);
    const vpX = translateMatch ? parseFloat(translateMatch[1]) : 0;
    const vpY = translateMatch ? parseFloat(translateMatch[2]) : 0;
    const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;

    // Convert screen container bounds to flow coordinates
    return {
      x: -vpX / scale,
      y: -vpY / scale,
      width: containerRect.width / scale,
      height: containerRect.height / scale,
    };
  });
}


/** Pick the first recipe from the recipe picker dialog. */
async function pickFirstRecipe(page: Page) {
  const recipeRow = page.locator('tr.recipe-row').first();
  await recipeRow.waitFor({ state: 'visible' });
  await recipeRow.click();
}

/** Wait for the node count to reach the expected value. */
async function waitForNodeCount(page: Page, count: number) {
  await expect(page.locator('.react-flow__node')).toHaveCount(count, { timeout: 5000 });
}

async function getNodeIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const nodes = document.querySelectorAll('.react-flow__node');
    return Array.from(nodes)
      .map(node => node.getAttribute('data-id') ?? '')
      .filter(Boolean);
  });
}

async function getPreferredHandleInfo(page: Page, nodeId: string) {
  return page.evaluate((id) => {
    const node = document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement | null;
    if (!node) throw new Error('Node not found');
    const handles = Array.from(node.querySelectorAll('.react-flow__handle')) as HTMLElement[];
    if (handles.length === 0) throw new Error('No handles found');

    const isFlipped = !!node.querySelector('img[data-flipped="true"]');
    const info = handles.map(handle => {
      const rect = handle.getBoundingClientRect();
      const dataType = handle.getAttribute('data-handletype') ?? handle.getAttribute('data-handle-type');
      const isSource = dataType === 'source' || handle.classList.contains('react-flow__handle-source');
      const isTarget = dataType === 'target' || handle.classList.contains('react-flow__handle-target');
      const handlePos = handle.getAttribute('data-handlepos')
        ?? (handle.classList.contains('react-flow__handle-left') ? 'left' : (handle.classList.contains('react-flow__handle-right') ? 'right' : null));
      const inferredType = handlePos
        ? (isFlipped ? (handlePos === 'left' ? 'output' : 'input') : (handlePos === 'right' ? 'output' : 'input'))
        : 'input';
      return {
        productId: handle.getAttribute('data-handleid') ?? '',
        handleType: isSource ? 'output' : (isTarget ? 'input' : inferredType),
        center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
      };
    });

    const preferred = info.find(item => item.handleType === 'output') ?? info[0];
    if (!preferred.productId) throw new Error('Handle missing product id');
    return preferred;
  }, nodeId);
}

async function getHandleCenterById(
  page: Page,
  nodeId: string,
  productId: string,
  handleType: 'input' | 'output'
) {
  const handleTypeAttr = handleType === 'output' ? 'source' : 'target';
  const locator = page.locator(
    `.react-flow__node[data-id="${nodeId}"] .react-flow__handle[data-handleid="${productId}"][data-handle-type="${handleTypeAttr}"]`
  ).first();
  await locator.waitFor({ state: 'attached' });
  return locator.evaluate((el) => {
    const rect = (el as HTMLElement).getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
}

async function getClosestHandleInfo(page: Page, nodeId: string, point: { x: number; y: number }) {
  return page.evaluate(({ id, target }) => {
    const node = document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement | null;
    if (!node) throw new Error('Node not found');
    const handles = Array.from(node.querySelectorAll('.react-flow__handle')) as HTMLElement[];
    if (handles.length === 0) throw new Error('No handles found');

    const isFlipped = !!node.querySelector('img[data-flipped="true"]');
    const infos = handles.map(handle => {
      const rect = handle.getBoundingClientRect();
      const dataType = handle.getAttribute('data-handletype') ?? handle.getAttribute('data-handle-type');
      const isSource = dataType === 'source' || handle.classList.contains('react-flow__handle-source');
      const isTarget = dataType === 'target' || handle.classList.contains('react-flow__handle-target');
      const handlePos = handle.getAttribute('data-handlepos')
        ?? (handle.classList.contains('react-flow__handle-left') ? 'left' : (handle.classList.contains('react-flow__handle-right') ? 'right' : null));
      const inferredType = handlePos
        ? (isFlipped ? (handlePos === 'left' ? 'output' : 'input') : (handlePos === 'right' ? 'output' : 'input'))
        : 'input';
      return {
        handleType: isSource ? 'output' : (isTarget ? 'input' : inferredType),
        center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
      };
    });

    let closest = infos[0];
    let minDistance = Math.hypot(closest.center.x - target.x, closest.center.y - target.y);

    for (const info of infos.slice(1)) {
      const distance = Math.hypot(info.center.x - target.x, info.center.y - target.y);
      if (distance < minDistance) {
        minDistance = distance;
        closest = info;
      }
    }

    return { ...closest, distance: minDistance };
  }, { id: nodeId, target: point });
}

async function isNodeFlipped(page: Page, nodeId: string) {
  const flipped = await page
    .locator(`.react-flow__node[data-id="${nodeId}"] img[data-flipped="true"]`)
    .count();
  return flipped > 0;
}

/** Zoom out the React Flow viewport by scrolling on the canvas center. */
async function zoomOut(page: Page, scrolls = 5) {
  const canvas = page.locator('.react-flow__viewport');
  await canvas.waitFor({ state: 'visible' });
  const canvasBounds = await page.locator('.react-flow').boundingBox();
  if (canvasBounds) {
    const centerX = canvasBounds.x + canvasBounds.width / 2;
    const centerY = canvasBounds.y + canvasBounds.height / 2;
    for (let i = 0; i < scrolls; i++) {
      await page.mouse.move(centerX, centerY);
      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(300);
  }
}

test.describe('Smart Node Placement from Sidebar', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Wait for auto-redirect to a zone/factory
    await page.waitForURL(/\/zones\//, { timeout: 5000 });
    // Wait for the sidebar to be visible
    await expect(page.getByTestId('sidebar-goals-list')).toBeVisible();
  });

  test('multiple nodes added sequentially from sidebar do not overlap', async ({ page }) => {
    // Add first goal and producer
    await addGoal(page, 'Copper', 10);
    await addProducerFromGoal(page, 0);
    await pickFirstRecipe(page);
    await waitForNodeCount(page, 1);
    await zoomOut(page);
    // Add second goal (different product) and producer
    await addGoal(page, 'Iron', 10);
    await addProducerFromGoal(page, 1);
    await pickFirstRecipe(page);
    await waitForNodeCount(page, 2);
    await zoomOut(page);

    // Add third goal and producer
    await addGoal(page, 'Coal', 10);
    await addProducerFromGoal(page, 2);
    await pickFirstRecipe(page);
    await waitForNodeCount(page, 3);
    await zoomOut(page);

    // Verify none of the three nodes overlap
    const allRects = await getNodeRects(page);
    expect(allRects.length).toBe(3);
    // Log positions for debugging - check both screen and flow positions
    const rectsStr = JSON.stringify(allRects.map(r => ({id: r.id.substring(0, 20), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)})));
    
    // Also get flow-coordinate positions from the DOM data attributes
    const flowPositions = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.react-flow__node');
      return Array.from(nodes).map(node => {
        const el = node as HTMLElement;
        const transform = el.style.transform;
        return {
          id: (el.getAttribute('data-id') ?? '').substring(0, 20),
          transform,
          style: el.getAttribute('style'),
        };
      });
    });
    const flowStr = JSON.stringify(flowPositions);
    
    const overlaps = findOverlaps(allRects, PADDING);
    expect(overlaps, `Screen rects: ${rectsStr} | Flow: ${flowStr} | Overlapping: ${JSON.stringify(overlaps)}`).toHaveLength(0);
  });

  test('sidebar-placed node is within the visible viewport', async ({ page }) => {
    // Add a goal and use "Add Producer"
    await addGoal(page, 'Iron', 10);
    await addProducerFromGoal(page, 0);
    await pickFirstRecipe(page);
    await waitForNodeCount(page, 1);
    await zoomOut(page);

    // The node should be within the React Flow container bounds
    const allRects = await getNodeRects(page);
    expect(allRects.length).toBe(1);
    const nodeRect = allRects[0];
    const container = await getContainerRect(page);

    // Assert the node is within the container bounds (screen pixels)
    expect(nodeRect.x, 'node left edge should be inside container').toBeGreaterThanOrEqual(
      container.x - PADDING
    );
    expect(nodeRect.y, 'node top edge should be inside container').toBeGreaterThanOrEqual(
      container.y - PADDING
    );
    expect(
      nodeRect.x + nodeRect.width,
      'node right edge should be inside container'
    ).toBeLessThanOrEqual(container.x + container.width + PADDING);
    expect(
      nodeRect.y + nodeRect.height,
      'node bottom edge should be inside container'
    ).toBeLessThanOrEqual(container.y + container.height + PADDING);
  });

  test('five nodes added sequentially all avoid overlap', async ({ page }) => {
    // Use unique product names that won't have ambiguous fuzzy matches
    const products = ['Copper', 'Steel', 'Glass', 'Coal', 'Gold'];

    for (let i = 0; i < products.length; i++) {
      await addGoal(page, products[i], 10);
      await addProducerFromGoal(page, i);
      await pickFirstRecipe(page);
      await waitForNodeCount(page, i + 1);
      // Zoom out more aggressively as more nodes accumulate,
      // since auto-fit makes the viewport progressively tighter
      await zoomOut(page, 5 + i * 2);
    }

    const allRects = await getNodeRects(page);
    expect(allRects.length).toBe(products.length);

    const rectsStr = JSON.stringify(allRects.map(r => ({id: r.id.substring(0, 20), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)})));
    const overlaps = findOverlaps(allRects, PADDING);
    expect(overlaps, `Rects: ${rectsStr} | Overlapping: ${JSON.stringify(overlaps)}`).toHaveLength(0);
  });

  test('handle drop aligns new node to expected handle (right)', async ({ page }) => {
    await addGoal(page, 'Copper', 10);
    await addProducerFromGoal(page, 0);
    await pickFirstRecipe(page);
    await waitForNodeCount(page, 1);
    await zoomOut(page, 3);

    const initialNodeIds = await getNodeIds(page);
    const sourceNodeId = initialNodeIds[0];
    const sourceHandleInfo = await getPreferredHandleInfo(page, sourceNodeId);
    const sourceCenter = await getHandleCenterById(
      page,
      sourceNodeId,
      sourceHandleInfo.productId,
      sourceHandleInfo.handleType as 'input' | 'output'
    );
    const dropRight = { x: sourceCenter.x + 250, y: sourceCenter.y };
    const shouldFlipRight = sourceHandleInfo.handleType === 'output'
      ? dropRight.x < sourceCenter.x
      : dropRight.x > sourceCenter.x;

    await page.mouse.move(sourceCenter.x, sourceCenter.y);
    await page.mouse.down();
    await page.mouse.move(dropRight.x, dropRight.y);
    await page.mouse.up();

    await pickFirstRecipe(page);
    await waitForNodeCount(page, 2);

    const afterRightIds = await getNodeIds(page);
    const newRightNodeId = afterRightIds.find(id => !initialNodeIds.includes(id));
    if (!newRightNodeId) throw new Error('Expected a new node after right drop');

    const rightClosest = await getClosestHandleInfo(page, newRightNodeId, dropRight);
    expect(rightClosest.distance).toBeLessThan(25);
    expect(await isNodeFlipped(page, newRightNodeId)).toBe(shouldFlipRight);
  });

  test('handle drop aligns new node to expected handle (left)', async ({ page }) => {
    await addGoal(page, 'Copper', 10);
    await addProducerFromGoal(page, 0);
    await pickFirstRecipe(page);
    await waitForNodeCount(page, 1);
    await zoomOut(page, 3);

    const initialNodeIds = await getNodeIds(page);
    const sourceNodeId = initialNodeIds[0];
    const sourceHandleInfo = await getPreferredHandleInfo(page, sourceNodeId);
    const sourceCenter = await getHandleCenterById(
      page,
      sourceNodeId,
      sourceHandleInfo.productId,
      sourceHandleInfo.handleType as 'input' | 'output'
    );
    const dropLeft = { x: sourceCenter.x - 250, y: sourceCenter.y };
    const shouldFlipLeft = sourceHandleInfo.handleType === 'output'
      ? dropLeft.x < sourceCenter.x
      : dropLeft.x > sourceCenter.x;

    await page.mouse.move(sourceCenter.x, sourceCenter.y);
    await page.mouse.down();
    await page.mouse.move(dropLeft.x, dropLeft.y);
    await page.mouse.up();

    await pickFirstRecipe(page);
    await waitForNodeCount(page, 2);

    const afterLeftIds = await getNodeIds(page);
    const newLeftNodeId = afterLeftIds.find(id => !initialNodeIds.includes(id));
    if (!newLeftNodeId) throw new Error('Expected a new node after left drop');

    const leftClosest = await getClosestHandleInfo(page, newLeftNodeId, dropLeft);
    expect(leftClosest.distance).toBeLessThan(25);
    expect(await isNodeFlipped(page, newLeftNodeId)).toBe(shouldFlipLeft);
  });
});
