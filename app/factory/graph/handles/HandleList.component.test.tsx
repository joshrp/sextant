import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ReactFlowProvider, Position } from '@xyflow/react';
import HandleList from './HandleList';
import ProductHandle from './ProductHandle';
import type { ProductId } from '../loadJsonData';
import type { HighlightProduct } from '~/context/store';

// Wrapper to provide ReactFlowProvider for tests
const renderWithReactFlow = (ui: React.ReactElement) => {
  return render(<ReactFlowProvider>{ui}</ReactFlowProvider>);
};

const mockProduct1 = {
  id: 'Product1' as ProductId,
  name: 'Product 1',
  icon: 'Product1Icon',
  color: '#ff0000',
  unit: 'units',
  transport: 'Flat' as const,
  recipes: { input: [], output: [] },
  machines: { input: [], output: [] },
};

const mockProduct2 = {
  id: 'Product2' as ProductId,
  name: 'Product 2',
  icon: 'Product2Icon',
  color: '#00ff00',
  unit: 'kg',
  transport: 'Loose' as const,
  recipes: { input: [], output: [] },
  machines: { input: [], output: [] },
};

const highlight: HighlightProduct = {
  productId: 'Product1' as ProductId,
  mode: 'product',
  options: {
    edges: true,
    connected: true,
    unconnected: true,
    inputs: true,
    outputs: false,
  }
};

describe('HandleList Component', () => {
  describe('Basic Rendering', () => {
    it('renders list container', () => {
      const { container } = renderWithReactFlow(
        <HandleList
          pos={Position.Left}
          inputs={true}
        >
          <div>Test child</div>
        </HandleList>
      );

      expect(container.querySelector('.recipe-list')).toBeInTheDocument();
    });

    it('renders children', () => {
      const { container } = renderWithReactFlow(
        <HandleList
          pos={Position.Left}
          inputs={true}
        >
          <ProductHandle
            product={mockProduct1}
            quantity={105}
            position={Position.Left}
            isInput={true}
            isConnected={false}
            productColor="#ff0000"
            ltr={true}
            displayRunCount={1}
            highlight={highlight}
            hasSwitch={false}
          />
          <ProductHandle
            product={mockProduct2}
            quantity={1010}
            position={Position.Left}
            isInput={true}
            isConnected={false}
            productColor="#00ff00"
            ltr={true}
            displayRunCount={1}
            highlight={highlight}
            hasSwitch={false}
          />
        </HandleList>
      );

      const handles = container.querySelectorAll('.recipe-handle');
      expect(handles.length).toBe(2);
      expect(container.querySelectorAll('.recipe-inputs .recipe-handle')[0]?.getAttribute('data-highlight')).toEqual("true");
      expect(container.querySelectorAll('.recipe-inputs .recipe-handle')[1]?.getAttribute('data-muted')).toEqual("true");
      expect(handles[0].textContent).toContain('105 units');
      expect(handles[1].textContent).toContain('1,010 kg');

    });
  });

  describe('Input vs Output Layout', () => {
    it('applies input class for input handles', () => {
      const { container } = renderWithReactFlow(
        <HandleList
          pos={Position.Left}
          inputs={true}
        >
          <div>Test</div>
        </HandleList>
      );

      expect(container.querySelector('.recipe-inputs')).toBeInTheDocument();

      expect(container.querySelector('.recipe-outputs')).not.toBeInTheDocument();
    });

    it('applies output class for output handles', () => {
      const { container } = renderWithReactFlow(
        <HandleList
          pos={Position.Right}
          inputs={false}
        >         
        <ProductHandle
            product={mockProduct2}
            quantity={1010}
            position={Position.Left}
            isInput={false}
            isConnected={false}
            productColor="#00ff00"
            ltr={true}
            displayRunCount={1}
            highlight={highlight}
            hasSwitch={false}
          />
        </HandleList>
      );

      expect(container.querySelector('.recipe-outputs')).toBeInTheDocument();
      expect(container.querySelectorAll('.recipe-outputs [data-highlight="true"]').length).toBe(0);
      expect(container.querySelectorAll('.recipe-outputs [data-muted="true"]').length).toBe(1);
      expect(container.querySelector('.recipe-inputs')).not.toBeInTheDocument();
    });
  });

  describe('Position Styling', () => {
    it('applies left positioning for left position', () => {
      const { container } = renderWithReactFlow(
        <HandleList
          pos={Position.Left}
          inputs={true}
        >
          <div>Test</div>
        </HandleList>
      );

      const list = container.querySelector('.recipe-list');
      expect(list?.classList.contains('-left-2')).toBe(true);
    });

    it('applies right positioning for right position', () => {
      const { container } = renderWithReactFlow(
        <HandleList
          pos={Position.Right}
          inputs={false}
        >
          <div>Test</div>
        </HandleList>
      );

      const list = container.querySelector('.recipe-list');
      expect(list?.classList.contains('-right-2')).toBe(true);
    });
  });

});
