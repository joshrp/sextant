import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';
import type { RecipeNodeViewProps } from './RecipeNodeView';
import RecipeNodeView from './RecipeNodeView';
import { loadData, type RecipeId } from './loadJsonData';


const { recipes } = loadData();

// Helper to create mock product edges
const createMockProductEdges = (recipe: ReturnType<typeof recipes.get>) => {
  const edges = new Map();
  if (recipe) {
    recipe.inputs.forEach(input => edges.set(input.product.id, null));
    recipe.outputs.forEach(output => edges.set(output.product.id, null));
  }
  return edges;
};

// Helper to get a recipe and create base props
const getRecipeProps = (recipeId: RecipeId, overrides?: Partial<RecipeNodeViewProps>): RecipeNodeViewProps => {
  const recipe = recipes.get(recipeId);
  if (!recipe) throw new Error(`Recipe ${recipeId} not found`);

  return {
    recipe,
    productEdges: createMockProductEdges(recipe),
    ltr: true,
    zoomLevel: 0,
    onFlip: vi.fn(),
    onRemove: vi.fn(),

    ...overrides,
  };
};

// Wrapper to provide ReactFlowProvider for tests
const renderWithReactFlow = (ui: React.ReactElement) => {
  return render(<ReactFlowProvider>{ui}</ReactFlowProvider>);
};

describe('RecipeNodeView Component', () => {
  describe('Basic Rendering', () => {
    it('renders recipe machine name', () => {
      const props = getRecipeProps('PowerGeneratorT2' as RecipeId);
      renderWithReactFlow(<RecipeNodeView {...props} />);

      expect(screen.getByText(/Power generator/i)).toBeInTheDocument();
    });

    it('renders run count', () => {
      const props = getRecipeProps('PowerGeneratorT2' as RecipeId, { solution: { runCount: 5.5, solved: true } });
      const { container } = renderWithReactFlow(<RecipeNodeView {...props} />);

      const runCountDisplay = container.querySelector('.w-full.my-1.text-2xl');
      expect(runCountDisplay?.textContent).toContain('5.5');
    });
  });

  describe('Layout Orientation', () => {
    it('renders in ltr mode', () => {
      const props = getRecipeProps('PowerGeneratorT2' as RecipeId, { ltr: true });
      const { container } = renderWithReactFlow(<RecipeNodeView {...props} />);

      const flipIcon = container.querySelector('[title="Flip Direction"] svg');
      expect(flipIcon?.classList.contains('scale-x-[-1]')).toBe(false);

      const machineImg = container.querySelector('[data-flipped]');
      // When ltr is true, data-flipped attribute should not have value "true", may be null or undefined
      expect(machineImg?.getAttribute('data-flipped')).not.toBe('true');
    });

    it('renders in rtl mode', () => {
      const props = getRecipeProps('PowerGeneratorT2' as RecipeId, { ltr: false });
      const { container } = renderWithReactFlow(<RecipeNodeView {...props} />);

      const flipIcon = container.querySelector('[title="Flip Direction"] svg');
      expect(flipIcon?.classList.contains('scale-x-[-1]')).toBe(true);

      const machineImg = container.querySelector('[data-flipped="true"]');
      expect(machineImg).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onFlip when flip button is clicked', async () => {
      const user = userEvent.setup();
      const onFlip = vi.fn();
      const props = getRecipeProps('PowerGeneratorT2' as RecipeId, { onFlip });
      const { container } = renderWithReactFlow(<RecipeNodeView {...props} />);

      const flipButton = container.querySelector('[title="Flip Direction"]') as HTMLElement;
      await user.click(flipButton);

      expect(onFlip).toHaveBeenCalledTimes(1);
    });

    it('calls onRemove when remove button is clicked', async () => {
      const user = userEvent.setup();
      const onRemove = vi.fn();
      const props = getRecipeProps('PowerGeneratorT2' as RecipeId, { onRemove });
      const { container } = renderWithReactFlow(<RecipeNodeView {...props} />);

      const buttons = container.querySelectorAll('button');
      const removeButton = Array.from(buttons).find(btn =>
        btn.classList.contains('text-red-500/50')
      ) as HTMLElement;

      await user.click(removeButton);

      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('Solution States', () => {
    it('displays default run count without solution', () => {
      const props = getRecipeProps('PowerGeneratorT2' as RecipeId, {
        solution: { solved: false }
      });
      const { container } = renderWithReactFlow(<RecipeNodeView {...props} />);

      const runCountDisplay = container.querySelector('.w-full.my-1.text-2xl');
      expect(runCountDisplay?.textContent).toContain('1');
    });

    it('displays solution run count when provided', () => {
      const props = getRecipeProps('PowerGeneratorT2' as RecipeId, {
        solution: { solved: true, runCount: 5.5 }
      });
      const { container } = renderWithReactFlow(<RecipeNodeView {...props} />);

      const runCountDisplay = container.querySelector('.w-full.my-1.text-2xl');
      expect(runCountDisplay?.textContent).toContain('5.5');
    });

    it('displays high precision for low run counts', () => {
      const props = getRecipeProps('PowerGeneratorT2' as RecipeId, { solution: { solved: true, runCount: 2.567442 } });
      const { container } = renderWithReactFlow(<RecipeNodeView {...props} />);

      const runCountDisplay = container.querySelector('.w-full.my-1.text-2xl');
      // Low run counts (< 10) should have 3 significant figures - checking for the value
      expect(runCountDisplay?.textContent).toContain('2.567');
    });

    it('displays low precision for high run counts', () => {
      const props = getRecipeProps('PowerGeneratorT2' as RecipeId, { solution: { solved: true, runCount: 15.567888 } });
      const { container } = renderWithReactFlow(<RecipeNodeView {...props} />);

      const runCountDisplay = container.querySelector('.w-full.my-1.text-2xl');
      // High run counts (>= 10) should have 1 decimal place
      expect(runCountDisplay?.textContent).toMatch(/15\.6/);
    });
  });

  describe('Infrastructure Display', () => {
    it('renders all infrastructure icons', () => {
      const props = getRecipeProps('PowerGeneratorT2' as RecipeId);
      const { container } = renderWithReactFlow(<RecipeNodeView {...props} />);

      const infraBar = container.querySelector('.recipe-node-infra-bar');
      expect(infraBar).toBeInTheDocument();

      const infraIcons = infraBar?.querySelectorAll('.flex-1.text-center');
      expect(infraIcons?.length).toBeGreaterThan(0);
    });

    it('displays basic infrastructure consumption', () => {
      const props = getRecipeProps('PowerGeneratorT2' as RecipeId);
      const { container } = renderWithReactFlow(<RecipeNodeView {...props} />);

      const electricityIcon = container.querySelector('[title="Electricity"]');
      expect(electricityIcon).toBeInTheDocument();

      // Look for worker icon title
      const workerIcon = Array.from(container.querySelectorAll('[title]')).find(el =>
        el.getAttribute('title')?.includes('Workers')
      );
      expect(workerIcon).toBeInTheDocument();

      const maintenanceIcon = Array.from(container.querySelectorAll('[title]')).find(el =>
        el.getAttribute('title')?.includes('Maintenance')
      );
      expect(maintenanceIcon).toBeInTheDocument();

      const footprintIcon = Array.from(container.querySelectorAll('[title]')).find(el =>
        el.getAttribute('title')?.includes('Footprint')
      );
      expect(footprintIcon).toBeInTheDocument();
    });
  });

  describe('Product Handles', () => {
    it('renders input handles on left side when ltr', () => {
      const props = getRecipeProps('PowerGeneratorT2' as RecipeId, { ltr: true });
      const { container } = renderWithReactFlow(<RecipeNodeView {...props} />);

      const inputsList = container.querySelector('.recipe-inputs');
      expect(inputsList).toBeInTheDocument();
      expect(inputsList?.classList.contains('-left-2')).toBe(true);
    });

    it('renders output handles on right side when ltr', () => {
      const props = getRecipeProps('PowerGeneratorT2' as RecipeId, { ltr: true });
      const { container } = renderWithReactFlow(<RecipeNodeView {...props} />);

      const outputsList = container.querySelector('.recipe-outputs');
      expect(outputsList).toBeInTheDocument();
      expect(outputsList?.classList.contains('-right-2')).toBe(true);
    });

    it('swaps input/output sides when rtl', () => {
      const props = getRecipeProps('PowerGeneratorT2' as RecipeId, { ltr: false });
      const { container } = renderWithReactFlow(<RecipeNodeView {...props} />);

      const inputsList = container.querySelector('.recipe-inputs');
      const outputsList = container.querySelector('.recipe-outputs');

      // When ltr=false, inputs should be on right, outputs on left
      expect(inputsList?.classList.contains('-right-2')).toBe(true);
      expect(outputsList?.classList.contains('-left-2')).toBe(true);
    });

    it('displays product quantities with solution', () => {
      const props = getRecipeProps('PowerGeneratorT2' as RecipeId, {
        solution: { solved: true, runCount: 2.5 }
      });
      const { container } = renderWithReactFlow(<RecipeNodeView {...props} />);

      // Product quantities should be multiplied by run count
      const handles = container.querySelectorAll('.recipe-handle');
      expect(handles.length).toBeGreaterThan(0);
    });
  });

  describe('Different Recipe Types', () => {
    it('renders TurbineHighPressT2 correctly', () => {
      const props = getRecipeProps('TurbineHighPressT2' as RecipeId);
      renderWithReactFlow(<RecipeNodeView {...props} />);

      expect(screen.getByText(/Turbine/i)).toBeInTheDocument();
    });

    it('renders SteamDepletedCondensation correctly', () => {
      const props = getRecipeProps('SteamDepletedCondensation' as RecipeId);
      renderWithReactFlow(<RecipeNodeView {...props} />);

      expect(screen.getByText(/Cooling/i)).toBeInTheDocument();
    });

    it('renders FastBreederReactorEnrichment2 correctly', () => {
      const props = getRecipeProps('FastBreederReactorEnrichment2' as RecipeId);
      renderWithReactFlow(<RecipeNodeView {...props} />);

      expect(screen.getByText(/Fast/i)).toBeInTheDocument();
    });
  });
});
