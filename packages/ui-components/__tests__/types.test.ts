/**
 * Types Tests
 * v13 Section 4.5.1
 */

import { describe, it, expect } from 'vitest';
import {
  CARD_DIMENSIONS,
  BREAKPOINT_COLUMNS,
  FILTER_TABS,
  type MissionCardType,
  type HeartState,
  type Mission,
  type FilterTab,
} from '../src/types';

describe('CARD_DIMENSIONS', () => {
  it('should have all 9 card types', () => {
    const types: MissionCardType[] = [
      'shopping',
      'savings',
      'consumables',
      'content',
      'travel',
      'entertainment',
      'food',
      'people',
      'health',
    ];

    types.forEach((type) => {
      expect(CARD_DIMENSIONS[type]).toBeDefined();
    });
  });

  it('should have correct shopping card dimensions', () => {
    expect(CARD_DIMENSIONS.shopping).toEqual({
      type: 'shopping',
      height: 290,
      hasImage: true,
      hasBrandLogo: true,
      hasPrice: true,
    });
  });

  it('should have correct savings card dimensions', () => {
    expect(CARD_DIMENSIONS.savings).toEqual({
      type: 'savings',
      height: 284,
      hasImage: true,
      hasBrandLogo: true,
      hasPrice: false,
    });
  });

  it('should have correct travel card dimensions', () => {
    expect(CARD_DIMENSIONS.travel).toEqual({
      type: 'travel',
      height: 208,
      hasImage: true,
      hasBrandLogo: false,
      hasPrice: false,
    });
  });

  it('should have correct health card dimensions', () => {
    expect(CARD_DIMENSIONS.health).toEqual({
      type: 'health',
      height: 180,
      hasImage: true,
      hasBrandLogo: false,
      hasPrice: false,
    });
  });

  it('should only have shopping with hasPrice=true', () => {
    const cardsWithPrice = Object.entries(CARD_DIMENSIONS).filter(
      ([_, dims]) => dims.hasPrice
    );
    expect(cardsWithPrice.length).toBe(1);
    expect(cardsWithPrice[0][0]).toBe('shopping');
  });
});

describe('BREAKPOINT_COLUMNS', () => {
  it('should have default value', () => {
    expect(BREAKPOINT_COLUMNS.default).toBe(4);
  });

  it('should have 1440px breakpoint', () => {
    expect(BREAKPOINT_COLUMNS[1440]).toBe(4);
  });

  it('should have 1280px breakpoint', () => {
    expect(BREAKPOINT_COLUMNS[1280]).toBe(3);
  });

  it('should have 1024px breakpoint', () => {
    expect(BREAKPOINT_COLUMNS[1024]).toBe(3);
  });

  it('should have 768px breakpoint', () => {
    expect(BREAKPOINT_COLUMNS[768]).toBe(2);
  });

  it('should have 640px breakpoint', () => {
    expect(BREAKPOINT_COLUMNS[640]).toBe(2);
  });

  it('should decrease columns as screen gets smaller', () => {
    expect(BREAKPOINT_COLUMNS[1440]).toBeGreaterThanOrEqual(BREAKPOINT_COLUMNS[1280]);
    expect(BREAKPOINT_COLUMNS[1280]).toBeGreaterThanOrEqual(BREAKPOINT_COLUMNS[768]);
    expect(BREAKPOINT_COLUMNS[768]).toBeGreaterThanOrEqual(BREAKPOINT_COLUMNS[640]);
  });
});

describe('FILTER_TABS', () => {
  it('should have 4 tabs', () => {
    expect(FILTER_TABS.length).toBe(4);
  });

  it('should have all tab', () => {
    expect(FILTER_TABS.find((t) => t.id === 'all')).toBeDefined();
  });

  it('should have savings tab', () => {
    expect(FILTER_TABS.find((t) => t.id === 'savings')).toBeDefined();
  });

  it('should have ikigai tab', () => {
    expect(FILTER_TABS.find((t) => t.id === 'ikigai')).toBeDefined();
  });

  it('should have health tab', () => {
    expect(FILTER_TABS.find((t) => t.id === 'health')).toBeDefined();
  });

  it('should have labels for all tabs', () => {
    FILTER_TABS.forEach((tab) => {
      expect(tab.label).toBeDefined();
      expect(tab.label.length).toBeGreaterThan(0);
    });
  });
});

describe('Type definitions', () => {
  it('should allow valid MissionCardType', () => {
    const types: MissionCardType[] = [
      'shopping',
      'savings',
      'consumables',
      'content',
      'travel',
      'entertainment',
      'food',
      'people',
      'health',
    ];
    expect(types.length).toBe(9);
  });

  it('should allow valid HeartState', () => {
    const states: HeartState[] = ['meh', 'like', 'love'];
    expect(states.length).toBe(3);
  });

  it('should allow valid FilterTab', () => {
    const tabs: FilterTab[] = ['all', 'savings', 'ikigai', 'health'];
    expect(tabs.length).toBe(4);
  });

  it('should create valid Mission object', () => {
    const mission: Mission = {
      id: 'test-1',
      type: 'shopping',
      title: 'Test Product',
      createdAt: Date.now(),
    };
    expect(mission.id).toBe('test-1');
    expect(mission.type).toBe('shopping');
  });

  it('should allow optional Mission fields', () => {
    const mission: Mission = {
      id: 'test-1',
      type: 'shopping',
      title: 'Test',
      subtitle: 'Subtitle',
      imageUrl: 'https://example.com/img.jpg',
      brandName: 'Brand',
      brandLogoUrl: 'https://example.com/logo.jpg',
      price: 29.99,
      originalPrice: 49.99,
      currency: '$',
      actionUrl: 'https://example.com',
      feedbackState: 'like',
      createdAt: Date.now(),
    };
    expect(mission.subtitle).toBe('Subtitle');
    expect(mission.price).toBe(29.99);
    expect(mission.feedbackState).toBe('like');
  });
});
