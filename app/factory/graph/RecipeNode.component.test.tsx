import 'fake-indexeddb/auto';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithFactory } from '~/test/helpers/renderHelpers';
import type { HandleProps, NodeProps } from '@xyflow/react';
import { DEFAULT_ZONE_MODIFIERS } from '~/context/zoneModifiers';

// Mock zone context to provide default modifiers
vi.mock('~/context/ZoneContext', () => ({
  default: () => { throw new Error('useProductionZone should not be called directly in these tests'); },
  useProductionZoneStore: () => DEFAULT_ZONE_MODIFIERS,
}));

// Mock React Flow hooks and components
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    useUpdateNodeInternals: () => vi.fn(),
    useStore: vi.fn(selector => {
      selector({
        // default to x=0, y=0, zoom=1 (closer zoom)
        transform: [0, 0, 1],
      })
    }),
    Handle: ({ children, id, type, position, ...props }: HandleProps) => (
      <div 
        data-testid={`handle-${type}-${id}`}
        data-handleid={id}
        data-handletype={type}
        data-handlepos={position}
        {...props}
      >
        {children}
      </div>
    ),
    Position: {
      Left: 'left',
      Right: 'right',
      Top: 'top',
      Bottom: 'bottom',
    },
  };
});

// Import after mocks are set up
import RecipeNode from './RecipeNode';
import type { RecipeNodeData } from './recipeNodeLogic';
import type { RecipeNode as RecipeNodeType } from './RecipeNode';
import type { RecipeId } from './loadJsonData';

describe('RecipeNode Component', () => {
  const createNodeProps = (data: RecipeNodeData, id = 'test-node-1'): NodeProps<RecipeNodeType> => ({
    id,
    data,
    type: 'recipe',
    selected: false,
    isConnectable: true,
    dragging: false,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    width: 200,
    height: 200,
  } as NodeProps<RecipeNodeType>);

  beforeEach(() => {
    vi.clearAllMocks();
    // Note: fake-indexeddb is reset automatically between tests
  });

  describe('Error State', () => {
    it('renders error message for non-existent recipe', () => {
      const props = createNodeProps({
        type: "recipe",
        recipeId: 'NonExistentRecipe_12345' as RecipeId,
        ltr: true,
      });

      const { container } = renderWithFactory(<RecipeNode {...props} />);

      // Verify error state elements
      expect(screen.getByText('Recipe Not Found')).toBeInTheDocument();
      expect(screen.getByText(/Error: Recipe ID.*not found/)).toBeInTheDocument();
      
      // Verify the error styling is applied
      const errorNode = container.querySelector('.recipe-node');
      expect(errorNode).toBeInTheDocument();
      const errorMessage = container.querySelector('.text-red-500');
      expect(errorMessage).toBeInTheDocument();
    });

    it('renders delete button in error state', () => {
      const props = createNodeProps({
        type: "recipe",
        recipeId: 'InvalidRecipe' as RecipeId,
        ltr: true,
      });

      const { container } = renderWithFactory(<RecipeNode {...props} />);

      // Verify delete button exists in error state
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(1);
      
      // Verify it's a delete button by checking for the trash icon
      const trashIcon = buttons[0].querySelector('svg');
      expect(trashIcon).toBeInTheDocument();
    });
  });

  describe('Valid Recipe Rendering', () => {
    it('renders machine name and title bar', () => {
      const props = createNodeProps({
        type: "recipe",
        recipeId: 'PowerGeneratorT2' as RecipeId,
        ltr: true,
      });

      const { container } = renderWithFactory(<RecipeNode {...props} />);

      // Verify recipe node structure
      const node = container.querySelector('.recipe-node');
      expect(node).toBeInTheDocument();
      
      // Verify title bar
      const titleBar = container.querySelector('.recipe-node-title-bar');
      expect(titleBar).toBeInTheDocument();
      
      // Verify machine name is displayed (Power generator)
      expect(screen.getByText(/Power generator/i)).toBeInTheDocument();
    });

    it('displays run count in center of node', () => {
      const props = createNodeProps({
        type: "recipe",
        recipeId: 'PowerGeneratorT2' as RecipeId,
        ltr: true,
      });

      const { container } = renderWithFactory(<RecipeNode {...props} />);

      // Find the run count display
      const runCountDisplay = container.querySelector('.w-full.my-1.text-2xl');
      expect(runCountDisplay).toBeInTheDocument();
      expect(runCountDisplay?.textContent).toContain('1');
    });

    it('displays solution run count when provided', () => {
      const props = createNodeProps({
        type: "recipe",
        recipeId: 'PowerGeneratorT2' as RecipeId,
        ltr: true,
        solution: {
          solved: true,
          runCount: 5.5,
        },
      });

      const { container } = renderWithFactory(<RecipeNode {...props} />);

      // Verify solution run count is displayed
      const runCountDisplay = container.querySelector('.w-full.my-1.text-2xl');
      expect(runCountDisplay?.textContent).toContain('5.5');
    });

    it('renders flip button with correct icon', () => {
      const props = createNodeProps({
        type: "recipe",
        recipeId: 'PowerGeneratorT2' as RecipeId,
        ltr: true,
      });

      const { container } = renderWithFactory(<RecipeNode {...props} />);

      // Verify flip button
      const flipButton = container.querySelector('[title="Flip Direction"]');
      expect(flipButton).toBeInTheDocument();
      
      // Verify it has the arrow icon
      const arrowIcon = flipButton?.querySelector('svg');
      expect(arrowIcon).toBeInTheDocument();
    });

    it('renders delete button with trash icon', () => {
      const props = createNodeProps({
        type: "recipe",
        recipeId: 'PowerGeneratorT2' as RecipeId,
        ltr: true,
      });

      const { container } = renderWithFactory(<RecipeNode {...props} />);

      const buttons = container.querySelectorAll('button');
      const deleteButton = Array.from(buttons).find(btn => 
        btn.querySelector('svg path')?.getAttribute('d')?.includes('14.74')
      );
      
      expect(deleteButton).toBeInTheDocument();
      expect(deleteButton?.classList.contains('text-red-500/50')).toBe(true);
    });

    it('renders product handles for recipe inputs and outputs', () => {
      const props = createNodeProps({
        type: "recipe",
        recipeId: 'PowerGeneratorT2' as RecipeId,
        ltr: true,
      });

      renderWithFactory(<RecipeNode {...props} />);

      // PowerGeneratorT2 should have handles for its inputs and outputs
      const handles = screen.getAllByTestId(/^handle-(target|source)-/);
      expect(handles.length).toBeGreaterThan(0);
      
      // Verify handle structure
      handles.forEach(handle => {
        expect(handle).toHaveAttribute('data-handleid');
        expect(handle).toHaveAttribute('data-handletype');
      });
    });
  });

  describe('Layout Orientation', () => {
    it('defaults to ltr layout', () => {
      const props = createNodeProps({
        type: "recipe",
        recipeId: 'PowerGeneratorT2' as RecipeId,
        // ltr not specified
      });

      const { container } = renderWithFactory(<RecipeNode {...props} />);

      const node = container.querySelector('.recipe-node');
      expect(node).toBeInTheDocument();
      
      // Verify flip button is in standard orientation
      const flipButton = container.querySelector('[title="Flip Direction"]');
      const icon = flipButton?.querySelector('svg');
      expect(icon?.classList.contains('scale-x-[-1]')).toBe(false);
    });

    it('renders with rtl layout when ltr=false', () => {
      const props = createNodeProps({
        type: "recipe",
        recipeId: 'PowerGeneratorT2' as RecipeId,
        ltr: false,
      });

      const { container } = renderWithFactory(<RecipeNode {...props} />);

      const node = container.querySelector('.recipe-node');
      expect(node).toBeInTheDocument();
      
      // Verify flip button icon is flipped
      const flipButton = container.querySelector('[title="Flip Direction"]');
      const icon = flipButton?.querySelector('svg');
      expect(icon?.classList.contains('scale-x-[-1]')).toBe(true);
    });
  });

  describe('User Interactions', () => {
    it('flip button responds to clicks', async () => {
      const user = userEvent.setup();
      const props = createNodeProps({
        type: "recipe",
        recipeId: 'PowerGeneratorT2' as RecipeId,
        ltr: true,
      });

      const { container } = renderWithFactory(<RecipeNode {...props} />);

      const flipButton = container.querySelector('[title="Flip Direction"]') as HTMLElement;
      expect(flipButton).toBeInTheDocument();

      // Verify button is interactive
      await user.click(flipButton);
      
      // Button should still be present after click
      expect(flipButton).toBeInTheDocument();
    });

    it('delete button responds to clicks', async () => {
      const user = userEvent.setup();
      const props = createNodeProps({
        type: "recipe",
        recipeId: 'PowerGeneratorT2' as RecipeId,
        ltr: true,
      });

      const { container } = renderWithFactory(<RecipeNode {...props} />);

      const buttons = container.querySelectorAll('button');
      const deleteButton = Array.from(buttons).find(btn => 
        btn.classList.contains('text-red-500/50')
      ) as HTMLElement;
      
      expect(deleteButton).toBeInTheDocument();
      
      // Verify button is interactive
      await user.click(deleteButton);
    });
  });

  describe('Solution States', () => {
    it('displays default state without solution', () => {
      const props = createNodeProps({
        type: "recipe",
        recipeId: 'PowerGeneratorT2' as RecipeId,
        ltr: true,
      });

      const { container } = renderWithFactory(<RecipeNode {...props} />);

      // Verify default run count of 1
      const runCountDisplay = container.querySelector('.w-full.my-1.text-2xl');
      expect(runCountDisplay?.textContent).toContain('1');
    });

    it('displays unsolved solution state', () => {
      const props = createNodeProps({
        type: "recipe",
        recipeId: 'PowerGeneratorT2' as RecipeId,
        ltr: true,
        solution: {
          solved: false,
        },
      });

      const { container } = renderWithFactory(<RecipeNode {...props} />);

      // Should show default run count when not solved
      const runCountDisplay = container.querySelector('.w-full.my-1.text-2xl');
      expect(runCountDisplay?.textContent).toContain('1');
    });

    it('displays decimal run counts', () => {
      const props = createNodeProps({
        type: "recipe",
        recipeId: 'PowerGeneratorT2' as RecipeId,
        ltr: true,
        solution: {
          solved: true,
          runCount: 3.14,
        },
      });

      const { container } = renderWithFactory(<RecipeNode {...props} />);

      const runCountDisplay = container.querySelector('.w-full.my-1.text-2xl');
      expect(runCountDisplay?.textContent).toMatch(/3\.14/);
    });
  });

  describe('Multiple Recipe Types', () => {
    it('renders TurbineHighPressT2 correctly', () => {
      const props = createNodeProps({
        type: "recipe",
        recipeId: 'TurbineHighPressT2' as RecipeId,
        ltr: true,
      });

      const { container } = renderWithFactory(<RecipeNode {...props} />);

      const node = container.querySelector('.recipe-node');
      expect(node).toBeInTheDocument();
      
      const titleBar = container.querySelector('.recipe-node-title-bar');
      expect(titleBar).toBeInTheDocument();
    });

    it('renders SteamDepletedCondensation correctly', () => {
      const props = createNodeProps({
        type: "recipe",
        recipeId: 'SteamDepletedCondensation' as RecipeId,
        ltr: true,
      });

      const { container } = renderWithFactory(<RecipeNode {...props} />);

      const node = container.querySelector('.recipe-node');
      expect(node).toBeInTheDocument();
      
      const titleBar = container.querySelector('.recipe-node-title-bar');
      expect(titleBar).toBeInTheDocument();
    });
  });
});
