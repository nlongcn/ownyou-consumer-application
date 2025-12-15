import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBreakpoint } from '../../src/hooks/useBreakpoint';

describe('useBreakpoint hook', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
  });

  it('returns mobile breakpoint for width < 768', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.breakpoint).toBe('mobile');
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it('returns tablet breakpoint for width 768-1023', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.breakpoint).toBe('tablet');
    expect(result.current.isTablet).toBe(true);
  });

  it('returns desktop breakpoint for width 1024-1279', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1100, writable: true });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.breakpoint).toBe('desktop');
    expect(result.current.isDesktop).toBe(true);
  });

  it('returns wide breakpoint for width 1280-1439', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1350, writable: true });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.breakpoint).toBe('wide');
    expect(result.current.isDesktop).toBe(true);
  });

  it('returns ultrawide breakpoint for width >= 1440', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.breakpoint).toBe('ultrawide');
    expect(result.current.isDesktop).toBe(true);
  });

  it('returns correct columns for mobile', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.columns).toBe(2);
  });

  it('returns correct columns for desktop', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1100, writable: true });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.columns).toBe(3);
  });

  it('returns correct columns for ultrawide', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.columns).toBe(4);
  });

  it('returns correct card width for mobile (180px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.cardWidth).toBe(180);
  });

  it('returns correct card width for tablet (200px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.cardWidth).toBe(200);
  });

  it('returns correct card width for desktop (220px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1100, writable: true });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.cardWidth).toBe(220);
  });

  it('returns correct card width for wide (260px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1350, writable: true });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.cardWidth).toBe(260);
  });

  it('returns correct card width for ultrawide (280px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.cardWidth).toBe(280);
  });

  it('hides sidebar on mobile', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.showSidebar).toBe(false);
  });

  it('hides sidebar on tablet', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.showSidebar).toBe(false);
  });

  it('shows sidebar on desktop', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1100, writable: true });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.showSidebar).toBe(true);
  });

  it('returns current dimensions', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.width).toBe(1024);
    expect(result.current.height).toBe(768);
  });
});
