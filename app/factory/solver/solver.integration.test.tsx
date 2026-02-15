import "fake-indexeddb/auto";

import { describe, expect, test } from 'vitest';
import { fixtures, getTestStoreRunner, type FactoryFixture } from "../fixtures";

/**
 * Helper function to run a test case using a real store
 * @param fixture The test fixture with factory data and options
 */
export async function runTestCase(name: string, fixture: FactoryFixture) {
  console.log('Starting test case:', name);
  const [store, prom] = await getTestStoreRunner('test', fixture);

  await prom; 

  const state = store.Graph.getState();
  console.log('Starting expectations for test case', name);
  // Verify the solution was computed
  expect(state.solution).toBeDefined();

  if (state.solution && fixture.expected) {
    const solution = state.solution;

    // Verify objective value
    if (fixture.expected.objectiveValue !== undefined) {
      expect(solution.ObjectiveValue).toBeCloseTo(fixture.expected.objectiveValue, 2);
    }

    // Verify node counts
    if (fixture.expected.nodeCounts) {
      for (const expectedNode of fixture.expected.nodeCounts) {
        const actualNode = solution.nodeCounts?.find(
          n => n.nodeId === expectedNode.nodeId
        );
        expect(actualNode, `Could not find node with ID ${expectedNode.nodeId} in test case ${name}`).toBeDefined();
        if (actualNode) {
          expect(actualNode.count, `Node count mismatch for node ID ${expectedNode.nodeId} in test case ${name}`).toBeCloseTo(expectedNode.count, 2);
        }
      }
    }

    // Verify infrastructure if expected
    if (fixture.expected.infrastructure) {
      for (const [key, expectedValue] of Object.entries(fixture.expected.infrastructure)) {
        const actualValue = solution.infrastructure[key as keyof typeof solution.infrastructure];
        expect(actualValue, `Infrastructure mismatch for key ${key} in test case ${name}`).toBeCloseTo(expectedValue, 2);
      }
    }

    // Verify products if expected
    if (fixture.expected.products?.inputs) {
      for (const expectedProduct of fixture.expected.products.inputs) {
        const actualProduct = solution.products.inputs.find(
          p => p.productId === expectedProduct.productId
        );
        expect(actualProduct, `Product input mismatch for product ID ${expectedProduct.productId} in test case ${name}`).toBeDefined();
        if (actualProduct) {
          expect(actualProduct.amount, `Product input amount mismatch for product ID ${expectedProduct.productId} in test case ${name}`).toBeCloseTo(expectedProduct.amount, 2);
        }
      }
    }

    if (fixture.expected.products?.outputs) {
      for (const expectedProduct of fixture.expected.products.outputs) {
        const actualProduct = solution.products.outputs.find(
          p => p.productId === expectedProduct.productId
        );
        expect(actualProduct, `Product output mismatch for product ID ${expectedProduct.productId} in test case ${name}`).toBeDefined();
        if (actualProduct) {
          expect(actualProduct.amount, `Product output amount mismatch for product ID ${expectedProduct.productId} in test case ${name}`).toBeCloseTo(expectedProduct.amount, 2);
        }
      }
    }

    // Verify manifolds if expected
    if (fixture.expected.manifolds) {
      expect(solution.manifolds).toBeDefined();
      //loop each manifold and check values are close
      for (const [key, expectedValue] of Object.entries(fixture.expected.manifolds)) {
        const actualValue = solution.manifolds[key as keyof typeof solution.manifolds];
        expect(actualValue, `Manifold mismatch for key ${key} in test case ${name}`).toBeCloseTo(expectedValue, 2);
      }
    }
  }
  console.log('Finished test case:', name);
}

/**
 * Example test demonstrating how to use exported test data
 * 
 * To create test data:
 * 1. Build a factory in the UI
 * 2. Open Factory Settings > Debug tab
 * 3. Expand "Solver Test Data Export"
 * 4. Copy the JSON and paste it as a test fixture below
 */

describe("Store Solver Integration Tests", () => {
  test("Test fixtures directory exists and contains valid fixtures", () => {
    // If fixtures exist, validate they all have required fields
    Object.entries(fixtures).forEach(([name, fixture]) => {
      expect(fixture, `Fixture ${name} is missing "factory" property`).toHaveProperty("factory");
      expect(fixture, `Fixture ${name} is missing "scoringMethod" property`).toHaveProperty("scoringMethod");
      expect(Array.isArray(fixture.factory), `Fixture ${name} factory property is not an array`).toBe(true);
    });
  });

  /**
   * Run all fixtures as individual tests
   */
  test.each(Object.entries(fixtures))(
    "$0",
    async (name: string, fixture: FactoryFixture) => {
      await runTestCase(name, fixture);
    }
  );
});
