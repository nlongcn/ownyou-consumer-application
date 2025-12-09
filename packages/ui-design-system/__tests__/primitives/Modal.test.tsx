/**
 * Modal Primitive Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalClose,
  ModalBody,
  ModalFooter,
} from '../../src/primitives/Modal';

describe('Modal', () => {
  beforeEach(() => {
    // Reset body overflow before each test
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('should not render when closed', () => {
    render(
      <Modal open={false} onClose={() => {}}>
        Content
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        Content
      </Modal>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should render children', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <div>Modal Content</div>
      </Modal>
    );
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('should have aria-modal attribute', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        Content
      </Modal>
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('should set aria-label from title prop', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Settings Modal">
        Content
      </Modal>
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Settings Modal');
  });

  it('should call onClose when backdrop is clicked', () => {
    const handleClose = vi.fn();
    render(
      <Modal open={true} onClose={handleClose}>
        Content
      </Modal>
    );
    // Click the backdrop (the fixed overlay)
    const backdrop = document.querySelector('.bg-black\\/50');
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should not close on backdrop click when closeOnBackdropClick is false', () => {
    const handleClose = vi.fn();
    render(
      <Modal open={true} onClose={handleClose} closeOnBackdropClick={false}>
        Content
      </Modal>
    );
    const backdrop = document.querySelector('.bg-black\\/50');
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('should call onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <Modal open={true} onClose={handleClose}>
        Content
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should not close on Escape when closeOnEscape is false', () => {
    const handleClose = vi.fn();
    render(
      <Modal open={true} onClose={handleClose} closeOnEscape={false}>
        Content
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('should prevent body scroll when open', () => {
    render(
      <Modal open={true} onClose={() => {}}>
        Content
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should merge custom className', () => {
    render(
      <Modal open={true} onClose={() => {}} className="custom-class">
        Content
      </Modal>
    );
    const modalContent = document.querySelector('.custom-class');
    expect(modalContent).toBeInTheDocument();
  });
});

describe('ModalHeader', () => {
  it('should render with flex layout', () => {
    render(<ModalHeader data-testid="header">Header Content</ModalHeader>);
    const header = screen.getByTestId('header');
    expect(header.className).toContain('flex');
  });
});

describe('ModalTitle', () => {
  it('should render as h2', () => {
    render(<ModalTitle>Modal Title</ModalTitle>);
    const title = screen.getByRole('heading', { level: 2 });
    expect(title.textContent).toBe('Modal Title');
  });

  it('should apply display font', () => {
    render(<ModalTitle data-testid="title">Title</ModalTitle>);
    const title = screen.getByTestId('title');
    expect(title.className).toContain('font-display');
  });
});

describe('ModalClose', () => {
  it('should call onClose when clicked', () => {
    const handleClose = vi.fn();
    render(<ModalClose onClose={handleClose} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should have accessible label', () => {
    render(<ModalClose onClose={() => {}} />);
    expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
  });
});

describe('ModalBody', () => {
  it('should render children', () => {
    render(<ModalBody>Body content</ModalBody>);
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });
});

describe('ModalFooter', () => {
  it('should render with flex layout and gap', () => {
    render(<ModalFooter data-testid="footer">Footer</ModalFooter>);
    const footer = screen.getByTestId('footer');
    expect(footer.className).toContain('flex');
    expect(footer.className).toContain('gap-2');
  });
});
