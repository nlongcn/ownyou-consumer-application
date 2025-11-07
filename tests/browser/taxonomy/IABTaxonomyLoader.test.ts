/**
 * IAB Taxonomy Loader Tests
 *
 * Validates full IAB Audience Taxonomy 1.1 loading and lookup functionality
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  IABTaxonomyLoader,
  getTaxonomyValue,
  buildCategoryPath,
  getTierDepth,
  TaxonomySection,
} from '@browser/taxonomy'

describe('IAB Taxonomy Loader', () => {
  let loader: IABTaxonomyLoader

  beforeAll(() => {
    loader = IABTaxonomyLoader.getInstance()
  })

  describe('Initialization', () => {
    it('should load 1558 taxonomy entries', () => {
      const stats = loader.getStatistics()
      expect(stats.total_entries).toBe(1558)
    })

    it('should load all 6 sections', () => {
      const stats = loader.getStatistics()
      expect(stats.sections.demographics).toBeGreaterThan(0)
      expect(stats.sections.household_data).toBeGreaterThan(0)
      expect(stats.sections.personal_attributes).toBeGreaterThan(0)
      expect(stats.sections.personal_finance).toBeGreaterThan(0)
      expect(stats.sections.interests).toBeGreaterThan(0)
      expect(stats.sections.purchase_intent).toBeGreaterThan(0)
    })

    it('should load purchase classifications', () => {
      const stats = loader.getStatistics()
      expect(stats.purchase_classifications).toBeGreaterThan(0)
    })

    it('should return singleton instance', () => {
      const instance1 = IABTaxonomyLoader.getInstance()
      const instance2 = IABTaxonomyLoader.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('Lookup by ID', () => {
    it('should find demographics entries', () => {
      // ID 50: Male
      const male = loader.getById(50)
      expect(male).toBeDefined()
      expect(male?.name).toContain('Male')
      expect(male?.tier_1).toBe('Demographic')
      expect(male?.tier_2).toBe('Gender')
      expect(male?.tier_3).toBe('Male')
    })

    it('should find education entries', () => {
      // ID 20: College Education (4 tiers, tier_5 is empty)
      const collegeEd = loader.getById(20)
      expect(collegeEd).toBeDefined()
      expect(collegeEd?.tier_1).toBe('Demographic')
      expect(collegeEd?.tier_2).toBe('Education & Occupation')
      expect(collegeEd?.tier_3).toBe('Education (Highest Level)')
      expect(collegeEd?.tier_4).toBe('College Education')
      expect(collegeEd?.tier_5).toBe('')
    })

    it('should return undefined for invalid ID', () => {
      const invalid = loader.getById(99999)
      expect(invalid).toBeUndefined()
    })
  })

  describe('Section Lookup', () => {
    it('should get demographics entries', () => {
      const demographics = loader.getBySection(TaxonomySection.DEMOGRAPHICS)
      expect(demographics.length).toBeGreaterThan(0)
      demographics.forEach(entry => {
        expect(entry.tier_1).toBe('Demographic')
      })
    })

    it('should get interests entries', () => {
      const interests = loader.getBySection(TaxonomySection.INTERESTS)
      expect(interests.length).toBeGreaterThan(0)
      interests.forEach(entry => {
        expect(entry.tier_1).toBe('Interest')
      })
    })

    it('should get purchase intent entries', () => {
      const purchase = loader.getBySection(TaxonomySection.PURCHASE_INTENT)
      expect(purchase.length).toBeGreaterThan(0)
      purchase.forEach(entry => {
        expect(entry.tier_1).toBe('Purchase Intent*')
      })
    })
  })

  describe('Hierarchy Traversal', () => {
    it('should get children of Gender (ID 48)', () => {
      // Gender (ID 48) should have Male and Female as children
      const children = loader.getChildren(48)
      expect(children.length).toBeGreaterThan(0)

      const childNames = children.map(c => c.name)
      expect(childNames.some(name => name.includes('Male'))).toBe(true)
      expect(childNames.some(name => name.includes('Female'))).toBe(true)
    })

    it('should get parent of Male (ID 50)', () => {
      const male = loader.getById(50)
      expect(male).toBeDefined()

      const parent = loader.getParent(male!)
      expect(parent).toBeDefined()
      expect(parent?.name).toContain('Gender')
    })

    it('should get full path for nested entry', () => {
      // Bachelor's Degree (ID 20) - 5 tiers deep
      const entry = loader.getById(20)
      expect(entry).toBeDefined()

      const path = loader.getPath(entry!)
      expect(path.length).toBeGreaterThan(1)
      expect(path[0].tier_1).toBe('Demographic') // Root
      expect(path[path.length - 1].id).toBe(20) // Leaf
    })

    it('should get siblings', () => {
      // Male (ID 50) and Female (ID 49) are siblings
      const male = loader.getById(50)
      expect(male).toBeDefined()

      const siblings = loader.getSiblings(male!)
      expect(siblings.length).toBeGreaterThan(0)
      const siblingNames = siblings.map(s => s.name)
      expect(siblingNames.some(name => name.includes('Female'))).toBe(true)
    })

    it('should provide full lookup result', () => {
      const result = loader.lookup(50) // Male
      expect(result).toBeDefined()
      expect(result?.entry.id).toBe(50)
      expect(result?.path.length).toBeGreaterThan(0)
      expect(result?.children).toBeDefined()
      expect(result?.siblings).toBeDefined()
    })
  })

  describe('Search', () => {
    it('should search by name', () => {
      const results = loader.searchByName('Male')
      expect(results.length).toBeGreaterThan(0)
      results.forEach(entry => {
        expect(entry.name.toLowerCase()).toContain('male')
      })
    })

    it('should search within section', () => {
      const results = loader.searchByName('College', {
        section: TaxonomySection.DEMOGRAPHICS,
      })
      expect(results.length).toBeGreaterThan(0)
      results.forEach(entry => {
        expect(entry.tier_1).toBe('Demographic')
      })
    })

    it('should limit search results', () => {
      const results = loader.searchByName('Education', { limit: 5 })
      expect(results.length).toBeLessThanOrEqual(5)
    })

    it('should filter by tier depth', () => {
      const results = loader.searchByName('Demographic', { tier: 1 })
      results.forEach(entry => {
        expect(getTierDepth(entry)).toBe(1)
      })
    })
  })

  describe('Leaf Nodes', () => {
    it('should identify leaf nodes', () => {
      const allLeafs = loader.getLeafNodes()
      expect(allLeafs.length).toBeGreaterThan(0)

      // Leaf nodes should have no children
      allLeafs.forEach(leaf => {
        const children = loader.getChildren(leaf.id)
        expect(children.length).toBe(0)
      })
    })

    it('should get leaf nodes by section', () => {
      const leafs = loader.getLeafNodes(TaxonomySection.DEMOGRAPHICS)
      expect(leafs.length).toBeGreaterThan(0)
      leafs.forEach(entry => {
        expect(entry.tier_1).toBe('Demographic')
      })
    })
  })

  describe('Purchase Classifications', () => {
    it('should get purchase classification', () => {
      const purchaseClassifications = loader.getAllPurchaseClassifications()
      expect(purchaseClassifications.size).toBeGreaterThan(0)

      // Get first code
      const firstCode = Array.from(purchaseClassifications.keys())[0]
      const description = loader.getPurchaseClassification(firstCode)
      expect(description).toBeDefined()
      expect(typeof description).toBe('string')
    })
  })

  describe('Helper Functions', () => {
    it('should extract taxonomy value (deepest tier)', () => {
      // ID 20: College Education (4 tiers) should return tier_4
      const entry = loader.getById(20)
      expect(entry).toBeDefined()
      const value = getTaxonomyValue(entry!)
      expect(value).toBe('College Education')
    })

    it('should build category path', () => {
      const entry = loader.getById(50) // Male
      expect(entry).toBeDefined()
      const path = buildCategoryPath(entry!)
      expect(path).toContain('Demographic')
      expect(path).toContain('Gender')
      expect(path).toContain('Male')
      expect(path.split(' | ').length).toBeGreaterThan(1)
    })

    it('should get tier depth', () => {
      const collegeEd = loader.getById(20) // 4 tiers
      expect(getTierDepth(collegeEd!)).toBe(4)

      const gender = loader.getById(48) // 2 tiers
      expect(getTierDepth(gender!)).toBe(2)
    })
  })

  describe('Find by Tier Value', () => {
    it('should find entries by tier_2 value', () => {
      const results = loader.findByTierValue(2, 'Gender')
      expect(results.length).toBeGreaterThan(0)
      results.forEach(entry => {
        expect(entry.tier_2).toBe('Gender')
      })
    })

    it('should find entries by tier_3 value', () => {
      const results = loader.findByTierValue(3, 'Male')
      expect(results.length).toBeGreaterThan(0)
      results.forEach(entry => {
        expect(entry.tier_3).toBe('Male')
      })
    })
  })

  describe('Statistics', () => {
    it('should provide accurate statistics', () => {
      const stats = loader.getStatistics()

      expect(stats.total_entries).toBe(1558)
      expect(stats.sections.demographics).toBe(52)
      expect(stats.sections.household_data).toBe(105)
      expect(stats.sections.personal_attributes).toBe(4)
      expect(stats.sections.personal_finance).toBe(33)
      expect(stats.sections.interests).toBe(496)
      expect(stats.sections.purchase_intent).toBe(862)

      // Section totals (1552) != total_entries (1558) because 6 entries
      // are cross-sectional parent nodes not included in section index
      const sectionTotal = Object.values(stats.sections).reduce((a, b) => a + b, 0)
      expect(sectionTotal).toBe(1552)
      expect(stats.total_entries - sectionTotal).toBe(6) // 6 parent nodes
    })
  })
})
