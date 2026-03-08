import { ReactFlowProvider } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import AnnotationNode from './AnnotationNodeView';
import type { AnnotationNodeType } from './annotationNode';
import { createTestFactoryStore, getFactoryWrapper } from '../../../test/helpers/renderHelpers';

// This fixture tests the full AnnotationNode component with React Flow and Zustand context.

const factoryId = 'annotation-fixture-factory';
const factoryName = 'Annotation Fixture Factory';
const testStore = createTestFactoryStore(factoryId, factoryName);

const createNodeProps = (
  text: string,
  overrides?: Partial<NodeProps<AnnotationNodeType>>,
): NodeProps<AnnotationNodeType> => ({
  id: 'annotation-test-1',
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  zIndex: 1,
  dragging: false,
  isConnectable: false,
  selected: false,
  type: 'annotation-node',
  data: { text },
  ...overrides,
});

const wrap = (props: NodeProps<AnnotationNodeType>) =>
  getFactoryWrapper(
    <div style={{ background: '#1a1a1a', padding: '40px', display: 'inline-block' }}>
      <ReactFlowProvider>
        <AnnotationNode {...props} />
      </ReactFlowProvider>
    </div>,
    { store: testStore, factoryId, factoryName },
  );

export default {
  'Empty (no text)': () =>
    wrap(createNodeProps('')),

  'Short text': () =>
    wrap(createNodeProps('This is a short note.')),

  'Markdown — headings and lists': () =>
    wrap(
      createNodeProps(
        `## Goals\n\nSet a **production target** in the sidebar to tell the solver what to make.\n\n- Click the **+** next to Goals\n- Choose a product and quantity\n- Hit Solve`,
      ),
    ),

  'Long markdown': () =>
    wrap(
      createNodeProps(
        `## Welcome to Sextant\n\nThis factory shows a simple **power and construction** production chain.\n\n### How to use\n1. Read the annotations next to each node\n2. Click **Solve** to see how many machines you need\n3. Add your own recipes from the **Goals** sidebar\n4. Create a new factory tab for your own production plan\n\n> Double-click any annotation to edit its text.`,
      ),
    ),

  'Selected': () =>
    wrap(createNodeProps('Selected annotation node — border highlights.', { selected: true })),
};
