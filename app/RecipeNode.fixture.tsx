import RecipeNode from './factory/graph/RecipeNode';
import type { RecipeNodeData } from './factory/graph/recipeNodeLogic';
import type { RecipeId } from './factory/graph/loadJsonData';
import { createTestFactoryStore, getFactoryWrapper } from './test/helpers/renderHelpers';
import type { NodeProps } from '@xyflow/react';

// This fixture tests the full RecipeNode component with React Flow and Zustand context
// For testing the pure RecipeNodeView component, see RecipeNodeView.fixture.tsx

const createNodeProps = (data: RecipeNodeData, id = 'test-node-1') => ({
  id,
  position: { x: 0, y: 0 },
  type: 'recipe-node',
  data,
  dragging: false,
  zIndex: 100,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  isConnectable: true
});

const factoryId = 'test-factory-1';
const factoryName = 'Test Factory 1';
const testStore = createTestFactoryStore(factoryId, factoryName);

const simpleNode = (props: NodeProps & {data: RecipeNodeData}) => {
  return getFactoryWrapper(
    <div style={{ background: '#1a1a1a', padding: '20px', resize: 'both', overflow: 'auto'}} >
      <RecipeNode {...props} />
    </div>
    , {
      withReactFlow: true,
      store: testStore,
      factoryId,
      factoryName
    })
}

export default {
  'Basic - Power Generator': () => simpleNode(createNodeProps({
    recipeId: 'PowerGeneratorT2' as RecipeId,
    ltr: true,
  })),
  'Basic - Power Generator Flipped': () => simpleNode(createNodeProps({
    recipeId: 'PowerGeneratorT2' as RecipeId,
    ltr: false,
  })),
  'Complex - Fast Breeder Reactor': () => simpleNode(createNodeProps({
    recipeId: 'FastBreederReactorEnrichment2' as RecipeId,
    ltr: true,
  })),
  'With Solution - Low Run Count': () => simpleNode(createNodeProps({
    recipeId: 'PowerGeneratorT2' as RecipeId,
    ltr: true,
    solution: { solved: true, runCount: 2.5 }
  })),
  'With Solution - High Run Count': () => simpleNode(createNodeProps({
    recipeId: 'TurbineHighPressT2' as RecipeId,
    ltr: true,
    solution: { solved: true, runCount: 15.75 }
  })),
};
