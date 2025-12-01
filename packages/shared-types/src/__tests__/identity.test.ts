/**
 * Identity Types Tests - v13 Section 7.x
 *
 * Tests that BBS+ identity types (Pseudonym, DisclosureProof, TrackingId)
 * are correctly defined as stubs per the v13 architecture specification.
 */
import { describe, it, expect } from 'vitest';
import type { Pseudonym, DisclosureProof, TrackingId } from '../identity';

describe('Identity Types (v13 Section 7.x - BBS+ Stubs)', () => {
  describe('Pseudonym interface', () => {
    it('should have all required fields per v13 Section 7.1', () => {
      const pseudonym: Pseudonym = {
        id: 'nym_123',
        credentialHash: 'abc123hash...',
        issuerSignature: 'sig456...',
        paymentAddress: '0x1234567890abcdef...',
        createdAt: Date.now(),
      };

      expect(pseudonym.id).toBe('nym_123');
      expect(pseudonym.credentialHash).toBeDefined();
      expect(pseudonym.issuerSignature).toBeDefined();
      expect(pseudonym.paymentAddress).toBeDefined();
      expect(pseudonym.createdAt).toBeDefined();
    });

    it('should support optional lastUsedAt', () => {
      const pseudonym: Pseudonym = {
        id: 'nym_456',
        credentialHash: 'def789hash...',
        issuerSignature: 'sig012...',
        paymentAddress: '0xabcdef1234567890...',
        createdAt: Date.now() - 1000,
        lastUsedAt: Date.now(),
      };

      expect(pseudonym.lastUsedAt).toBeDefined();
      expect(pseudonym.lastUsedAt).toBeGreaterThan(pseudonym.createdAt);
    });
  });

  describe('DisclosureProof interface', () => {
    it('should have all required fields per v13 Section 7.1.4', () => {
      const proof: DisclosureProof = {
        pseudonymId: 'nym_123',
        disclosedAttributes: ['IAB-123', 'IAB-456'],
        proof: 'zkproof_base64...',
        nonce: 'nonce_abc123',
        timestamp: Date.now(),
      };

      expect(proof.pseudonymId).toBe('nym_123');
      expect(proof.disclosedAttributes).toContain('IAB-123');
      expect(proof.proof).toBeDefined();
      expect(proof.nonce).toBeDefined();
      expect(proof.timestamp).toBeDefined();
    });

    it('should support optional isValid field', () => {
      const proof: DisclosureProof = {
        pseudonymId: 'nym_789',
        disclosedAttributes: ['IAB-789'],
        proof: 'zkproof_verified...',
        nonce: 'nonce_def456',
        timestamp: Date.now(),
        isValid: true,
      };

      expect(proof.isValid).toBe(true);
    });
  });

  describe('TrackingId interface', () => {
    it('should have all required fields per v13 Section 7.1.4', () => {
      const trackingId: TrackingId = {
        id: 'tid_123',
        campaignId: 'campaign_456',
        pseudonymId: 'nym_789',
        trackingIdHash: 'hash_deterministic_abc...',
        createdAt: Date.now(),
        impressionCount: 0,
      };

      expect(trackingId.id).toBe('tid_123');
      expect(trackingId.campaignId).toBe('campaign_456');
      expect(trackingId.pseudonymId).toBe('nym_789');
      expect(trackingId.trackingIdHash).toBeDefined();
      expect(trackingId.impressionCount).toBe(0);
    });

    it('should track impressions', () => {
      const trackingId: TrackingId = {
        id: 'tid_456',
        campaignId: 'campaign_789',
        pseudonymId: 'nym_abc',
        trackingIdHash: 'hash_def...',
        createdAt: Date.now(),
        impressionCount: 42,
      };

      expect(trackingId.impressionCount).toBe(42);
    });
  });
});
