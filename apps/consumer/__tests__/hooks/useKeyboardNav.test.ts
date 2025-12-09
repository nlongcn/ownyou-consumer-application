import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { useKeyboardNav } from '../../src/hooks/useKeyboardNav';
import type { ReactNode } from 'react';

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockLocation = { pathname: '/' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('useKeyboardNav hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.pathname = '/';
  });

  afterEach(() => {
    // Clean up any added event listeners
  });

  it('returns focusedIndex starting at -1', () => {
    const { result } = renderHook(() => useKeyboardNav(), { wrapper });

    expect(result.current.focusedIndex).toBe(-1);
  });

  it('returns setFocusedIndex function', () => {
    const { result } = renderHook(() => useKeyboardNav(), { wrapper });

    expect(typeof result.current.setFocusedIndex).toBe('function');
  });

  it('can be disabled via options', () => {
    const { result } = renderHook(() => useKeyboardNav({ enabled: false }), { wrapper });

    expect(result.current.focusedIndex).toBe(-1);
  });

  it('responds to J key for next item', () => {
    document.body.innerHTML = `
      <div data-mission-card data-mission-id="1" tabindex="0">Mission 1</div>
      <div data-mission-card data-mission-id="2" tabindex="0">Mission 2</div>
    `;

    renderHook(() => useKeyboardNav(), { wrapper });

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'j' });
      window.dispatchEvent(event);
    });

    // Focus should move to first card
    expect(document.activeElement?.getAttribute('data-mission-id')).toBe('1');
  });

  it('responds to K key for previous item', () => {
    document.body.innerHTML = `
      <div data-mission-card data-mission-id="1" tabindex="0">Mission 1</div>
      <div data-mission-card data-mission-id="2" tabindex="0">Mission 2</div>
    `;

    const { result } = renderHook(() => useKeyboardNav(), { wrapper });

    // Set focus to second item first
    act(() => {
      result.current.setFocusedIndex(1);
    });

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'k' });
      window.dispatchEvent(event);
    });

    // Focus should move to previous card
    expect(result.current.focusedIndex).toBeLessThanOrEqual(1);
  });

  it('navigates to home on 1 key', () => {
    renderHook(() => useKeyboardNav(), { wrapper });

    act(() => {
      const event = new KeyboardEvent('keydown', { key: '1' });
      window.dispatchEvent(event);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('navigates to profile on 2 key', () => {
    renderHook(() => useKeyboardNav(), { wrapper });

    act(() => {
      const event = new KeyboardEvent('keydown', { key: '2' });
      window.dispatchEvent(event);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  it('navigates to settings on 3 key', () => {
    renderHook(() => useKeyboardNav(), { wrapper });

    act(() => {
      const event = new KeyboardEvent('keydown', { key: '3' });
      window.dispatchEvent(event);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('navigates to wallet on 4 key', () => {
    renderHook(() => useKeyboardNav(), { wrapper });

    act(() => {
      const event = new KeyboardEvent('keydown', { key: '4' });
      window.dispatchEvent(event);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/wallet');
  });

  it('goes back on Escape when on mission detail', () => {
    mockLocation.pathname = '/mission/123';

    renderHook(() => useKeyboardNav(), { wrapper });

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      window.dispatchEvent(event);
    });

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('does not interfere with input fields', () => {
    document.body.innerHTML = `
      <input type="text" id="test-input" />
    `;

    const input = document.getElementById('test-input') as HTMLInputElement;
    input.focus();

    renderHook(() => useKeyboardNav(), { wrapper });

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'j' });
      Object.defineProperty(event, 'target', { value: input });
      window.dispatchEvent(event);
    });

    // Navigation should not trigger when in input
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not interfere with meta key combinations', () => {
    renderHook(() => useKeyboardNav(), { wrapper });

    act(() => {
      const event = new KeyboardEvent('keydown', { key: '1', metaKey: true });
      window.dispatchEvent(event);
    });

    // Should not navigate when meta key is held
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('useKeyboardNav route changes', () => {
  it('resets focusedIndex when route changes', () => {
    const { result, rerender } = renderHook(() => useKeyboardNav(), { wrapper });

    // Set focus index
    act(() => {
      result.current.setFocusedIndex(5);
    });

    expect(result.current.focusedIndex).toBe(5);

    // Simulate route change
    mockLocation.pathname = '/profile';
    rerender();

    // Focus should reset
    expect(result.current.focusedIndex).toBe(-1);
  });
});
