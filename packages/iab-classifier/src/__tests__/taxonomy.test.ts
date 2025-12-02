/**
 * IAB Taxonomy Loader Tests - Sprint 1b
 *
 * Basic tests for taxonomy loading and lookup
 */

import { describe, it, expect } from 'vitest';
import { IABTaxonomyLoader, TaxonomySection } from '../taxonomy';

describe('IABTaxonomyLoader', () => {
  it('should be a singleton', () => {
    const loader1 = IABTaxonomyLoader.getInstance();
    const loader2 = IABTaxonomyLoader.getInstance();
    expect(loader1).toBe(loader2);
  });

  it('should lookup entry by ID', () => {
    const loader = IABTaxonomyLoader.getInstance();
    // ID 50 is "Male" in demographics
    const entry = loader.getById(50);
    expect(entry).toBeDefined();
    expect(entry?.tier_1).toBe('Demographic');
    expect(entry?.tier_3).toBe('Male');
  });

  it('should get entries by section', () => {
    const loader = IABTaxonomyLoader.getInstance();
    const demographics = loader.getBySection(TaxonomySection.DEMOGRAPHICS);
    expect(demographics.length).toBeGreaterThan(0);
    expect(demographics[0].tier_1).toBe('Demographic');
  });

  it('should get children of parent', () => {
    const loader = IABTaxonomyLoader.getInstance();
    // ID 48 is "Gender" - should have children "Male" and "Female"
    const children = loader.getChildren(48);
    expect(children.length).toBeGreaterThan(0);
  });
});

describe('TaxonomySection', () => {
  it('should have correct section values', () => {
    expect(TaxonomySection.DEMOGRAPHICS).toBe('demographics');
    expect(TaxonomySection.HOUSEHOLD_DATA).toBe('household_data');
    expect(TaxonomySection.INTERESTS).toBe('interests');
    expect(TaxonomySection.PURCHASE_INTENT).toBe('purchase_intent');
  });
});
