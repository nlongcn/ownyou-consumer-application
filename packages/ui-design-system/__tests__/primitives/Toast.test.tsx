/**
 * Toast Primitive Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { Toast, ToastContainer } from '../../src/primitives/Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render when open', () => {
    render(<Toast message="Test message" open={true} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('should not render when open is false', () => {
    render(<Toast message="Test message" open={false} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should render with title', () => {
    render(<Toast message="Body text" title="Toast Title" />);
    expect(screen.getByText('Toast Title')).toBeInTheDocument();
    expect(screen.getByText('Body text')).toBeInTheDocument();
  });

  it('should render with default variant', () => {
    render(<Toast message="Default" data-testid="toast" />);
    const toast = screen.getByTestId('toast');
    expect(toast.className).toContain('bg-card-bg');
  });

  it('should render with success variant', () => {
    render(<Toast message="Success!" variant="success" data-testid="toast" />);
    const toast = screen.getByTestId('toast');
    expect(toast.className).toContain('bg-ownyou-secondary');
  });

  it('should render with error variant', () => {
    render(<Toast message="Error!" variant="error" data-testid="toast" />);
    const toast = screen.getByTestId('toast');
    expect(toast.className).toContain('bg-red-500');
  });

  it('should render with warning variant', () => {
    render(<Toast message="Warning!" variant="warning" data-testid="toast" />);
    const toast = screen.getByTestId('toast');
    expect(toast.className).toContain('bg-yellow-500');
  });

  it('should render with info variant', () => {
    render(<Toast message="Info" variant="info" data-testid="toast" />);
    const toast = screen.getByTestId('toast');
    expect(toast.className).toContain('bg-ownyou-primary');
  });

  it('should have aria-live polite for accessibility', () => {
    render(<Toast message="Test" />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
  });

  it('should show close button by default', () => {
    render(<Toast message="Test" />);
    expect(screen.getByLabelText('Dismiss notification')).toBeInTheDocument();
  });

  it('should hide close button when showClose is false', () => {
    render(<Toast message="Test" showClose={false} />);
    expect(screen.queryByLabelText('Dismiss notification')).not.toBeInTheDocument();
  });

  it('should call onDismiss when close button is clicked', async () => {
    const handleDismiss = vi.fn();
    render(<Toast message="Test" onDismiss={handleDismiss} />);

    fireEvent.click(screen.getByLabelText('Dismiss notification'));

    // Wait for animation timeout
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('should auto-dismiss after duration', async () => {
    const handleDismiss = vi.fn();
    render(<Toast message="Test" duration={3000} onDismiss={handleDismiss} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Advance past duration
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Wait for animation
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('should not auto-dismiss when duration is 0', () => {
    const handleDismiss = vi.fn();
    render(<Toast message="Test" duration={0} onDismiss={handleDismiss} />);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(handleDismiss).not.toHaveBeenCalled();
  });

  it('should merge custom className', () => {
    render(<Toast message="Test" className="custom-class" data-testid="toast" />);
    const toast = screen.getByTestId('toast');
    expect(toast.className).toContain('custom-class');
  });
});

describe('ToastContainer', () => {
  it('should render children', () => {
    render(
      <ToastContainer>
        <Toast message="Toast 1" />
        <Toast message="Toast 2" />
      </ToastContainer>
    );
    expect(screen.getByText('Toast 1')).toBeInTheDocument();
    expect(screen.getByText('Toast 2')).toBeInTheDocument();
  });

  it('should position at bottom-right by default', () => {
    render(
      <ToastContainer data-testid="container">
        <Toast message="Test" />
      </ToastContainer>
    );
    const container = screen.getByTestId('container');
    expect(container.className).toContain('bottom-4');
    expect(container.className).toContain('right-4');
  });

  it('should position at top-right', () => {
    render(
      <ToastContainer position="top-right" data-testid="container">
        <Toast message="Test" />
      </ToastContainer>
    );
    const container = screen.getByTestId('container');
    expect(container.className).toContain('top-4');
    expect(container.className).toContain('right-4');
  });

  it('should position at top-center', () => {
    render(
      <ToastContainer position="top-center" data-testid="container">
        <Toast message="Test" />
      </ToastContainer>
    );
    const container = screen.getByTestId('container');
    expect(container.className).toContain('top-4');
    expect(container.className).toContain('left-1/2');
  });

  it('should have fixed positioning', () => {
    render(
      <ToastContainer data-testid="container">
        <Toast message="Test" />
      </ToastContainer>
    );
    const container = screen.getByTestId('container');
    expect(container.className).toContain('fixed');
  });

  it('should have high z-index', () => {
    render(
      <ToastContainer data-testid="container">
        <Toast message="Test" />
      </ToastContainer>
    );
    const container = screen.getByTestId('container');
    expect(container.className).toContain('z-50');
  });
});
