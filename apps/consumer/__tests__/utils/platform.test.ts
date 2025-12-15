import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getPlatform,
  isMobile,
  isTablet,
  isDesktop,
  getBreakpoint,
  isPWAInstalled,
  isTouchDevice,
  getFeatureAvailability,
  getColumns,
  getCardWidth,
} from '../../src/utils/platform';

describe('getPlatform', () => {
  beforeEach(() => {
    // Reset window.__TAURI__
    delete (window as { __TAURI__?: unknown }).__TAURI__;
  });

  it('returns pwa when not in Tauri', () => {
    expect(getPlatform()).toBe('pwa');
  });

  it('returns tauri when __TAURI__ is present', () => {
    (window as { __TAURI__?: unknown }).__TAURI__ = {};
    expect(getPlatform()).toBe('tauri');
  });
});

describe('isMobile', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
  });

  it('returns true for width < 768', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
    expect(isMobile()).toBe(true);
  });

  it('returns false for width >= 768', () => {
    Object.defineProperty(window, 'innerWidth', { value: 768, writable: true });
    expect(isMobile()).toBe(false);
  });
});

describe('isTablet', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
  });

  it('returns true for width 768-1023', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
    expect(isTablet()).toBe(true);
  });

  it('returns false for width < 768', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
    expect(isTablet()).toBe(false);
  });

  it('returns false for width >= 1024', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    expect(isTablet()).toBe(false);
  });
});

describe('isDesktop', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
  });

  it('returns true for width >= 1024', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    expect(isDesktop()).toBe(true);
  });

  it('returns false for width < 1024', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
    expect(isDesktop()).toBe(false);
  });
});

describe('getBreakpoint', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
  });

  it('returns mobile for width < 768', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
    expect(getBreakpoint()).toBe('mobile');
  });

  it('returns tablet for width 768-1023', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
    expect(getBreakpoint()).toBe('tablet');
  });

  it('returns desktop for width 1024-1279', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1100, writable: true });
    expect(getBreakpoint()).toBe('desktop');
  });

  it('returns wide for width 1280-1439', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1350, writable: true });
    expect(getBreakpoint()).toBe('wide');
  });

  it('returns ultrawide for width >= 1440', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
    expect(getBreakpoint()).toBe('ultrawide');
  });
});

describe('isPWAInstalled', () => {
  it('returns false when not in standalone mode', () => {
    expect(isPWAInstalled()).toBe(false);
  });
});

describe('isTouchDevice', () => {
  const originalOntouchstart = (window as { ontouchstart?: unknown }).ontouchstart;
  const originalMaxTouchPoints = navigator.maxTouchPoints;

  afterEach(() => {
    // Restore originals
    if (originalOntouchstart !== undefined) {
      (window as { ontouchstart?: unknown }).ontouchstart = originalOntouchstart;
    } else {
      delete (window as { ontouchstart?: unknown }).ontouchstart;
    }
    Object.defineProperty(navigator, 'maxTouchPoints', { value: originalMaxTouchPoints, writable: true, configurable: true });
  });

  it('returns false when no touch support', () => {
    // Remove ontouchstart from window
    delete (window as { ontouchstart?: unknown }).ontouchstart;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, writable: true, configurable: true });
    expect(isTouchDevice()).toBe(false);
  });

  it('returns true when touch is supported via maxTouchPoints', () => {
    delete (window as { ontouchstart?: unknown }).ontouchstart;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 1, writable: true, configurable: true });
    expect(isTouchDevice()).toBe(true);
  });

  it('returns true when ontouchstart is in window', () => {
    (window as { ontouchstart?: unknown }).ontouchstart = undefined;
    expect(isTouchDevice()).toBe(true);
  });
});

describe('getFeatureAvailability', () => {
  beforeEach(() => {
    delete (window as { __TAURI__?: unknown }).__TAURI__;
  });

  it('returns correct features for PWA', () => {
    const features = getFeatureAvailability();

    expect(features.deepLinks).toBe(false);
    expect(features.biometricAuth).toBe(false);
    expect(features.fileSystemAccess).toBe(false);
    expect(features.windowControls).toBe(false);
  });

  it('returns correct features for Tauri', () => {
    (window as { __TAURI__?: unknown }).__TAURI__ = {};

    const features = getFeatureAvailability();

    expect(features.deepLinks).toBe(true);
    expect(features.biometricAuth).toBe(true);
    expect(features.fileSystemAccess).toBe(true);
    expect(features.windowControls).toBe(true);
  });
});

describe('getColumns', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
  });

  it('returns 2 columns for mobile', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
    expect(getColumns()).toBe(2);
  });

  it('returns 2 columns for tablet', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
    expect(getColumns()).toBe(2);
  });

  it('returns 3 columns for desktop', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1100, writable: true });
    expect(getColumns()).toBe(3);
  });

  it('returns 3 columns for wide', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1350, writable: true });
    expect(getColumns()).toBe(3);
  });

  it('returns 4 columns for ultrawide', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
    expect(getColumns()).toBe(4);
  });
});

describe('getCardWidth', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
  });

  it('returns 180 for mobile', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
    expect(getCardWidth()).toBe(180);
  });

  it('returns 200 for tablet', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
    expect(getCardWidth()).toBe(200);
  });

  it('returns 220 for desktop', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1100, writable: true });
    expect(getCardWidth()).toBe(220);
  });

  it('returns 260 for wide', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1350, writable: true });
    expect(getCardWidth()).toBe(260);
  });

  it('returns 280 for ultrawide', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
    expect(getCardWidth()).toBe(280);
  });
});
