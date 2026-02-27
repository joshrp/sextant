/**
 * Tests for GraphStore reducer functions
 * These test pure state transformations without side effects
 */
import { describe, expect, test, vi } from 'vitest';
import {
  updateNodeData,
  updateEdgeData,
  cloneNodesEdges,
  updateScoringMethod,
  updateBaseWeights,
  solutionUpdateAction,
  validateManifolds,
  type SolutionUpdateStateInputs,
  type SolutionUpdateStateOutputs,
} from './graphReducers';
import { basicGraphState, emptyGraphState } from '~/test/fixtures/graphStates';
import type { ProductId } from '~/factory/graph/loadJsonData';
import type { GraphStore } from '~/factory/store';
import type { ManifoldOptions, GraphModel } from '~/factory/solver/types';
import type { RecipeNode } from '~/factory/graph/RecipeNode';

/** Narrow a CustomNodeType to RecipeNode for type-safe assertions */
const asRecipe = (node: { data: unknown }) => node as RecipeNode;

describe('GraphStore Reducers', () => {
  describe('updateNodeData', () => {
    test('updates node data immutably', () => {
      const result = updateNodeData(basicGraphState, 'node-1', { ltr: false });

      // Node data should be updated
      expect(asRecipe(result.nodes[0]).data.ltr).toBe(false);
      // Other node data should be preserved
      expect(asRecipe(result.nodes[0]).data.recipeId).toBe('SteamLpCondensation');
      // State should be immutable (new object)
      expect(result).not.toBe(basicGraphState);
      expect(result.nodes).not.toBe(basicGraphState.nodes);
      // Other nodes should not be affected
      expect(result.nodes[1]).toBe(basicGraphState.nodes[1]);
    });

    test('merges partial data correctly', () => {
      const result = updateNodeData(basicGraphState, 'node-1', {
        solution: { solved: true, runCount: 5 },
      });

      expect(asRecipe(result.nodes[0]).data.solution).toEqual({ solved: true, runCount: 5 });
      expect(asRecipe(result.nodes[0]).data.recipeId).toBe('SteamLpCondensation');
      expect(asRecipe(result.nodes[0]).data.ltr).toBe(true);
    });

    test('handles missing node gracefully', () => {
      const result = updateNodeData(basicGraphState, 'nonexistent', { ltr: false });

      // State should still be different object
      expect(result).not.toBe(basicGraphState);
      // But nodes array should be effectively unchanged
      expect(result.nodes).toHaveLength(basicGraphState.nodes.length);
      result.nodes.forEach((node, i) => {
        expect(node).toBe(basicGraphState.nodes[i]);
      });
    });

    test('works with empty state', () => {
      const result = updateNodeData(emptyGraphState, 'node-1', { ltr: false });

      expect(result.nodes).toHaveLength(0);
      expect(result).not.toBe(emptyGraphState);
    });

    test('preserves other state properties', () => {
      const result = updateNodeData(basicGraphState, 'node-1', { ltr: false });

      expect(result.name).toBe(basicGraphState.name);
      expect(result.edges).toBe(basicGraphState.edges);
      expect(result.goals).toBe(basicGraphState.goals);
      expect(result.scoringMethod).toBe(basicGraphState.scoringMethod);
    });
  });

  describe('updateEdgeData', () => {
    test('updates edge data immutably', () => {
      const result = updateEdgeData(basicGraphState, 'edge-1', { isManifold: true });

      expect(result.edges[0].data?.isManifold).toBe(true);
      expect(result).not.toBe(basicGraphState);
      expect(result.edges).not.toBe(basicGraphState.edges);
    });

    test('merges partial edge data', () => {
      const result = updateEdgeData(basicGraphState, 'edge-1', {
        isManifold: true,
        manifoldState: 'Over',
      });

      expect(result.edges[0].data?.isManifold).toBe(true);
      expect(result.edges[0].data?.manifoldState).toBe('Over');
    });

    test('handles missing edge gracefully', () => {
      const result = updateEdgeData(basicGraphState, 'nonexistent', { isManifold: true });

      expect(result).not.toBe(basicGraphState);
      expect(result.edges).toHaveLength(basicGraphState.edges.length);
    });

    test('works with empty state', () => {
      const result = updateEdgeData(emptyGraphState, 'edge-1', { isManifold: true });

      expect(result.edges).toHaveLength(0);
      expect(result).not.toBe(emptyGraphState);
    });

    test('preserves other state properties', () => {
      const result = updateEdgeData(basicGraphState, 'edge-1', { isManifold: true });

      expect(result.name).toBe(basicGraphState.name);
      expect(result.nodes).toBe(basicGraphState.nodes);
      expect(result.goals).toBe(basicGraphState.goals);
      expect(result.scoringMethod).toBe(basicGraphState.scoringMethod);
    });
  });

  describe('cloneNodesEdges', () => {
    test('creates new arrays for nodes and edges', () => {
      const result = cloneNodesEdges(basicGraphState);

      expect(result).not.toBe(basicGraphState);
      expect(result.nodes).not.toBe(basicGraphState.nodes);
      expect(result.edges).not.toBe(basicGraphState.edges);
    });

    test('preserves node and edge contents', () => {
      const result = cloneNodesEdges(basicGraphState);

      expect(result.nodes).toHaveLength(basicGraphState.nodes.length);
      expect(result.edges).toHaveLength(basicGraphState.edges.length);
      // Elements should be same references (shallow clone)
      result.nodes.forEach((node, i) => {
        expect(node).toBe(basicGraphState.nodes[i]);
      });
      result.edges.forEach((edge, i) => {
        expect(edge).toBe(basicGraphState.edges[i]);
      });
    });

    test('works with empty state', () => {
      const result = cloneNodesEdges(emptyGraphState);

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
      expect(result.nodes).not.toBe(emptyGraphState.nodes);
      expect(result.edges).not.toBe(emptyGraphState.edges);
    });

    test('preserves other state properties', () => {
      const result = cloneNodesEdges(basicGraphState);

      expect(result.name).toBe(basicGraphState.name);
      expect(result.goals).toBe(basicGraphState.goals);
      expect(result.scoringMethod).toBe(basicGraphState.scoringMethod);
    });
  });

  describe('updateScoringMethod', () => {
    test('updates scoring method', () => {
      const result = updateScoringMethod(basicGraphState, 'inputs');

      expect(result.scoringMethod).toBe('inputs');
      expect(result).not.toBe(basicGraphState);
    });

    test('handles all scoring methods', () => {
      const methods: Array<GraphStore['scoringMethod']> = ['infra', 'inputs', 'outputs', 'footprint'];

      methods.forEach(method => {
        const result = updateScoringMethod(basicGraphState, method);
        expect(result.scoringMethod).toBe(method);
      });
    });

    test('preserves other state properties', () => {
      const result = updateScoringMethod(basicGraphState, 'outputs');

      expect(result.name).toBe(basicGraphState.name);
      expect(result.nodes).toBe(basicGraphState.nodes);
      expect(result.edges).toBe(basicGraphState.edges);
      expect(result.goals).toBe(basicGraphState.goals);
    });
  });

  describe('updateBaseWeights', () => {
    const mockState = {
      baseWeights: {
        base: 'early' as const,
        products: new Map<ProductId, number>(),
        infrastructure: new Map<string, number>(),
      },
      someOtherProp: 'test',
    };

    test('updates weights when reference changes', () => {
      const newWeights = {
        base: 'mid' as const,
        products: new Map<ProductId, number>(),
        infrastructure: new Map<string, number>(),
      };

      const result = updateBaseWeights(mockState, newWeights);

      expect(result.baseWeights).toBe(newWeights);
      expect(result).not.toBe(mockState);
    });

    test('returns same state when weights unchanged (reference equality)', () => {
      const result = updateBaseWeights(mockState, mockState.baseWeights);

      // Should return exact same state object (no mutation needed)
      expect(result).toBe(mockState);
    });

    test('preserves other state properties', () => {
      const newWeights = {
        base: 'late' as const,
        products: new Map<ProductId, number>(),
        infrastructure: new Map<string, number>(),
      };

      const result = updateBaseWeights(mockState, newWeights);

      expect(result.someOtherProp).toBe(mockState.someOtherProp);
    });
  });

  describe('immutability checks', () => {
    test('all reducers return new state objects', () => {
      const state = basicGraphState;

      const results = [
        updateNodeData(state, 'node-1', { ltr: false }),
        updateEdgeData(state, 'edge-1', { isManifold: true }),
        cloneNodesEdges(state),
        updateScoringMethod(state, 'inputs'),
      ];

      results.forEach(result => {
        expect(result).not.toBe(state);
      });
    });

    test('modified arrays are new references', () => {
      const state = basicGraphState;

      const result1 = updateNodeData(state, 'node-1', { ltr: false });
      expect(result1.nodes).not.toBe(state.nodes);
      expect(result1.edges).toBe(state.edges); // Edges not modified

      const result2 = updateEdgeData(state, 'edge-1', { isManifold: true });
      expect(result2.edges).not.toBe(state.edges);
      expect(result2.nodes).toBe(state.nodes); // Nodes not modified
    });
  });

  describe('edge cases', () => {
    test('handles null/undefined data gracefully', () => {
      const result = updateNodeData(basicGraphState, 'node-1', {});

      expect(result.nodes[0].data).toEqual(basicGraphState.nodes[0].data);
    });

    test('handles updates to nodes/edges with no data property', () => {
      const stateWithoutData = {
        ...basicGraphState,
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
            sourceHandle: 'water' as ProductId,
            targetHandle: 'water' as ProductId,
            type: 'button-edge',
            // No data property
          },
        ],
      };

      const result = updateEdgeData(stateWithoutData, 'edge-1', { isManifold: true });

      expect(result.edges[0].data?.isManifold).toBe(true);
    });

    test('multiple sequential updates maintain immutability', () => {
      let state = basicGraphState;

      state = updateNodeData(state, 'node-1', { ltr: false });
      state = updateNodeData(state, 'node-2', { ltr: false });
      state = updateScoringMethod(state, 'inputs');

      expect(state).not.toBe(basicGraphState);
      expect(asRecipe(state.nodes[0]).data.ltr).toBe(false);
      expect(asRecipe(state.nodes[1]).data.ltr).toBe(false);
      expect(state.scoringMethod).toBe('inputs');
    });
  });

  describe('solutionUpdateAction', () => {

    const mockSolution: SolutionUpdateStateOutputs = {
      solutionStatus: 'Solved',
      solution: {
        scoringMethod: 'infra',
        goals: [],
        products: {
          inputs: [],
          outputs: [],
        },
        nodeCounts: [],
        manifolds: {},
        infrastructure: {
          workers: 0,
          electricity: 0,
          computing: 0,
          maintenance_1: 0,
          maintenance_2: 0,
          maintenance_3: 0,
          footprint: 0,
          workers_generated: 0,
          electricity_generated: 0,
          computing_generated: 0,
          maintenance_1_generated: 0,
          maintenance_2_generated: 0,
          maintenance_3_generated: 0,
        },
        ObjectiveValue: 0,
      },
    };

    const minimalState: SolutionUpdateStateInputs = {
      graph: {
        graph: {},
        constraints: {},
        itemConstraints: new Map(),
        nodeIdToLabels: {},
      },
      solution: undefined,
      goals: [],
      scoringMethod: 'infra' as const,
    };

    test('returns empty object if no graph in state', async () => {
      const mockSolver = vi.fn();
      const stateNoGraph = { ...minimalState, graph: undefined };

      const result = await solutionUpdateAction({
        state: stateNoGraph,
        solver: mockSolver,
      });

      expect(result).toEqual({});
    });

    test('returns Error status when solver fails', async () => {
      const mockSolver = vi.fn().mockResolvedValue('Error');

      const result = await solutionUpdateAction({
        state: minimalState,
        solver: mockSolver,
      });

      expect(result).toEqual({ solutionStatus: 'Error' });
    });

    test('returns Infeasible status when solver cannot find solution', async () => {
      const mockSolver = vi.fn().mockResolvedValue('Infeasible');

      const result = await solutionUpdateAction({
        state: minimalState,
        solver: mockSolver,
      });

      expect(result).toEqual({ solutionStatus: 'Infeasible' });
    });

    test('returns Solved status with solution when no manifolds', async () => {
      const mockSolverResult = { solution: mockSolution };
      const mockSolver = vi.fn().mockResolvedValue(mockSolverResult);

      const result = await solutionUpdateAction({
        state: minimalState,
        solver: mockSolver,
      });

      expect(result).toStrictEqual({
        solutionStatus: 'Solved',
        solution: mockSolution,
      });
    });

    test('returns Partial status when manifolds exist', async () => {
      const mockSolverResult = { solution: mockSolution };
      const mockSolver = vi.fn().mockResolvedValue(mockSolverResult);
      const stateWithManifolds = {
        ...minimalState,
        manifoldOptions: [
          {
            constraintId: 'c1',
            edges: { e1: true },
            free: false,
          },
        ],
      };

      const result = await solutionUpdateAction({
        state: stateWithManifolds,
        solver: mockSolver,
      });

      expect(result).toStrictEqual({
        solutionStatus: 'Partial',
        solution: mockSolution,
      });
    });

    test('includes manifoldOptions from solver in result', async () => {
      const newManifolds = [
        {
          constraintId: 'c1',
          edges: { e1: true, e2: true },
          free: true,
        },
      ];
      const mockSolverResult = {
        solution: mockSolution,
        manifolds: newManifolds,
      };
      const mockSolver = vi.fn().mockResolvedValue(mockSolverResult);

      const result = await solutionUpdateAction({
        state: minimalState,
        solver: mockSolver,
      });

      expect(result.manifoldOptions).toBe(newManifolds);
      expect(result.solutionStatus).toBe('Solved');
      expect(result.solution).toBe(mockSolution);
    });

    test('does not include manifoldOptions if solver does not return them', async () => {
      const mockSolverResult = { solution: mockSolution };
      const mockSolver = vi.fn().mockResolvedValue(mockSolverResult);

      const result = await solutionUpdateAction({
        state: minimalState,
        solver: mockSolver,
      });

      expect(result).not.toHaveProperty('manifoldOptions');
      expect(result).toStrictEqual({
        solutionStatus: 'Solved',
        solution: mockSolution,
      });
    });
  });

  describe('validateManifolds', () => {
    const mockConstraints: GraphModel['constraints'] = {
      'c1': {
        id: 'c1',
        productId: 'water' as ProductId,
        edges: { 'e1': true, 'e2': true },
        equality: 'eq',
        unconnected: false,
        terms: [],
        children: [],
      },
      'c2': {
        id: 'c2',
        productId: 'iron' as ProductId,
        edges: { 'e3': true },
        equality: 'eq',
        unconnected: false,
        terms: [],
        children: [],
      },
      'c3': {
        id: 'c3',
        productId: 'coal' as ProductId,
        edges: { 'e4': true, 'e5': true },
        equality: 'eq',
        unconnected: false,
        terms: [],
        children: [],
      },
    };

    const mockGraph: GraphModel = {
      constraints: mockConstraints,
      graph: {},
      itemConstraints: new Map(),
      nodeIdToLabels: {},
    };

    test('returns empty array when no graph provided', () => {
      const manifolds: ManifoldOptions[] = [
        {
          constraintId: 'c1',
          edges: { 'e1': true, 'e2': true },
          free: true,
        },
      ];

      const result = validateManifolds({
        manifoldOptions: manifolds,
        graph: undefined,
      });

      expect(result.manifoldOptions).toEqual([]);
    });

    test('filters out non-free manifolds', () => {
      const manifolds: ManifoldOptions[] = [
        {
          constraintId: 'c1',
          edges: { 'e1': true, 'e2': true },
          free: false,
        },
        {
          constraintId: 'c2',
          edges: { 'e3': true },
          free: true,
        },
      ];

      const result = validateManifolds({
        manifoldOptions: manifolds,
        graph: mockGraph,
      });

      expect(result.manifoldOptions).toHaveLength(1);
      expect(result.manifoldOptions[0].constraintId).toBe('c2');
    });

    test('removes manifolds with non-existent constraints', () => {
      const manifolds: ManifoldOptions[] = [
        {
          constraintId: 'nonexistent',
          edges: { 'e1': true },
          free: true,
        },
        {
          constraintId: 'c1',
          edges: { 'e1': true, 'e2': true },
          free: true,
        },
      ];

      const result = validateManifolds({
        manifoldOptions: manifolds,
        graph: mockGraph,
      });

      expect(result.manifoldOptions).toHaveLength(1);
      expect(result.manifoldOptions[0].constraintId).toBe('c1');
    });

    test('keeps manifolds when edges match exactly', () => {
      const manifolds: ManifoldOptions[] = [
        {
          constraintId: 'c1',
          edges: { 'e1': true, 'e2': true },
          free: true,
        },
        {
          constraintId: 'c2',
          edges: { 'e3': true },
          free: true,
        },
      ];

      const result = validateManifolds({
        manifoldOptions: manifolds,
        graph: mockGraph,
      });

      expect(result.manifoldOptions).toHaveLength(2);
      expect(result.manifoldOptions[0]).toEqual(manifolds[0]);
      expect(result.manifoldOptions[1]).toEqual(manifolds[1]);
    });

    test('updates constraintId when edges match different constraint', () => {
      // Manifold points to c1 but edges match c3
      const manifolds: ManifoldOptions[] = [
        {
          constraintId: 'c1',
          edges: { 'e4': true, 'e5': true },
          free: true,
        },
      ];

      const result = validateManifolds({
        manifoldOptions: manifolds,
        graph: mockGraph,
      });

      expect(result.manifoldOptions).toHaveLength(1);
      expect(result.manifoldOptions[0].constraintId).toBe('c3');
      expect(result.manifoldOptions[0].edges).toEqual({ 'e4': true, 'e5': true });
      expect(result.manifoldOptions[0].free).toBe(true);
    });

    test('removes manifolds when edges do not match any constraint', () => {
      const manifolds: ManifoldOptions[] = [
        {
          constraintId: 'c1',
          edges: { 'e99': true, 'e100': true },
          free: true,
        },
        {
          constraintId: 'c2',
          edges: { 'e3': true },
          free: true,
        },
      ];

      const result = validateManifolds({
        manifoldOptions: manifolds,
        graph: mockGraph,
      });

      // Only c2 should remain as its edges match
      expect(result.manifoldOptions).toHaveLength(1);
      expect(result.manifoldOptions[0].constraintId).toBe('c2');
    });

    test('handles empty manifoldOptions array', () => {
      const result = validateManifolds({
        manifoldOptions: [],
        graph: mockGraph,
      });

      expect(result.manifoldOptions).toEqual([]);
    });

    test('handles graph with no constraints', () => {
      const emptyGraph: GraphModel = {
        constraints: {},
        graph: {},
        itemConstraints: new Map(),
        nodeIdToLabels: {},
      };

      const manifolds: ManifoldOptions[] = [
        {
          constraintId: 'c1',
          edges: { 'e1': true },
          free: true,
        },
      ];

      const result = validateManifolds({
        manifoldOptions: manifolds,
        graph: emptyGraph,
      });

      expect(result.manifoldOptions).toEqual([]);
    });

    test('handles complex scenario with multiple updates and removals', () => {
      const manifolds: ManifoldOptions[] = [
        // Should be kept as-is (edges match c1)
        {
          constraintId: 'c1',
          edges: { 'e1': true, 'e2': true },
          free: true,
        },
        // Should be filtered out (free: false)
        {
          constraintId: 'c2',
          edges: { 'e3': true },
          free: false,
        },
        // Should be updated (edges match c2, not c1)
        {
          constraintId: 'c1',
          edges: { 'e3': true },
          free: true,
        },
        // Should be removed (constraint doesn't exist)
        {
          constraintId: 'c999',
          edges: { 'e1': true },
          free: true,
        },
        // Should be removed (edges don't match any constraint)
        {
          constraintId: 'c3',
          edges: { 'e99': true },
          free: true,
        },
      ];

      const result = validateManifolds({
        manifoldOptions: manifolds,
        graph: mockGraph,
      });

      expect(result.manifoldOptions).toHaveLength(2);
      
      // First should be unchanged
      expect(result.manifoldOptions[0]).toEqual({
        constraintId: 'c1',
        edges: { 'e1': true, 'e2': true },
        free: true,
      });
      
      // Second should have updated constraintId
      expect(result.manifoldOptions[1]).toEqual({
        constraintId: 'c2',
        edges: { 'e3': true },
        free: true,
      });
    });

    test('preserves manifold properties when updating constraintId', () => {
      const manifolds: ManifoldOptions[] = [
        {
          constraintId: 'c1',
          edges: { 'e3': true },
          free: true,
        },
      ];

      const result = validateManifolds({
        manifoldOptions: manifolds,
        graph: mockGraph,
      });

      expect(result.manifoldOptions[0]).toEqual({
        constraintId: 'c2',
        edges: { 'e3': true },
        free: true,
      });
    });
  });
});
