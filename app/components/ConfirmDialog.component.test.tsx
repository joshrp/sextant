import 'fake-indexeddb/auto';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with title and message when open', async () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
          title="Test Title"
        >
          Test message content
        </ConfirmDialog>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('Test message content')).toBeInTheDocument();
      });
    });

    it('renders default button text', async () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
          title="Title"
        >
          Message
        </ConfirmDialog>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      });
    });

  });

  describe('User Interactions', () => {

    it('renders custom button text and clicks it', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      render(
        <ConfirmDialog
          isOpen={true}
          onConfirm={onConfirm}
          onCancel={onCancel}
          title="Title"
          confirmText="Archive"
          cancelText="Go Back"
        >
          Message
        </ConfirmDialog>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Archive' }));
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      render(
        <ConfirmDialog
          isOpen={true}
          onConfirm={onConfirm}
          onCancel={onCancel}
          title="Title"
        >
          Message
        </ConfirmDialog>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});
