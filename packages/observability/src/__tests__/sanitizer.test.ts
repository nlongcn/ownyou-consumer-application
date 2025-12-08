/**
 * Privacy Sanitizer Tests - v13 Section 10.8
 *
 * Tests for PII redaction and content truncation in traces.
 */
import { describe, it, expect } from 'vitest';
import {
  sanitizeForTrace,
  DEFAULT_SANITIZE_CONFIG,
  type SanitizeConfig,
} from '../privacy';

describe('Privacy Sanitizer (v13 Section 10.8)', () => {
  describe('Content Truncation', () => {
    it('should truncate content exceeding maxLength', () => {
      const longContent = 'a'.repeat(300);
      const result = sanitizeForTrace(longContent);

      expect(result.length).toBeLessThanOrEqual(203); // 200 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should not truncate content within maxLength', () => {
      const shortContent = 'Hello, this is a short message.';
      const result = sanitizeForTrace(shortContent);

      expect(result).toBe(shortContent);
      expect(result.endsWith('...')).toBe(false);
    });

    it('should respect custom maxLength', () => {
      const content = 'a'.repeat(100);
      const config: SanitizeConfig = {
        ...DEFAULT_SANITIZE_CONFIG,
        maxLength: 50,
      };
      const result = sanitizeForTrace(content, config);

      expect(result.length).toBeLessThanOrEqual(53); // 50 + '...'
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('Email Redaction', () => {
    it('should redact email addresses', () => {
      const content = 'Contact me at john.doe@example.com for more info.';
      const result = sanitizeForTrace(content);

      expect(result).not.toContain('john.doe@example.com');
      expect(result).toContain('[EMAIL]');
    });

    it('should redact multiple email addresses', () => {
      const content = 'Send to alice@test.com or bob@company.org';
      const result = sanitizeForTrace(content);

      expect(result).not.toContain('alice@test.com');
      expect(result).not.toContain('bob@company.org');
      expect(result.match(/\[EMAIL\]/g)?.length).toBe(2);
    });

    it('should handle various email formats', () => {
      const emails = [
        'simple@example.com',
        'user.name+tag@example.co.uk',
        'email123@domain.io',
      ];

      for (const email of emails) {
        const result = sanitizeForTrace(`Test ${email} test`);
        expect(result).not.toContain(email);
        expect(result).toContain('[EMAIL]');
      }
    });

    it('should allow disabling email redaction', () => {
      const content = 'Contact: test@example.com';
      const config: SanitizeConfig = {
        ...DEFAULT_SANITIZE_CONFIG,
        redactPatterns: {
          ...DEFAULT_SANITIZE_CONFIG.redactPatterns,
          email: false,
        },
      };
      const result = sanitizeForTrace(content, config);

      expect(result).toContain('test@example.com');
    });
  });

  describe('Phone Number Redaction', () => {
    it('should redact US phone numbers with dashes', () => {
      const content = 'Call me at 555-123-4567 anytime.';
      const result = sanitizeForTrace(content);

      expect(result).not.toContain('555-123-4567');
      expect(result).toContain('[PHONE]');
    });

    it('should redact phone numbers with dots', () => {
      const content = 'Phone: 555.123.4567';
      const result = sanitizeForTrace(content);

      expect(result).not.toContain('555.123.4567');
      expect(result).toContain('[PHONE]');
    });

    it('should redact phone numbers without separators', () => {
      const content = 'Number: 5551234567';
      const result = sanitizeForTrace(content);

      expect(result).not.toContain('5551234567');
      expect(result).toContain('[PHONE]');
    });

    it('should allow disabling phone redaction', () => {
      const content = 'Phone: 555-123-4567';
      const config: SanitizeConfig = {
        ...DEFAULT_SANITIZE_CONFIG,
        redactPatterns: {
          ...DEFAULT_SANITIZE_CONFIG.redactPatterns,
          phone: false,
        },
      };
      const result = sanitizeForTrace(content, config);

      expect(result).toContain('555-123-4567');
    });
  });

  describe('Credit Card Redaction', () => {
    it('should redact credit card numbers with spaces', () => {
      const content = 'Card: 4111 1111 1111 1111';
      const result = sanitizeForTrace(content);

      expect(result).not.toContain('4111 1111 1111 1111');
      expect(result).toContain('[CARD]');
    });

    it('should redact credit card numbers with dashes', () => {
      const content = 'Card: 4111-1111-1111-1111';
      const result = sanitizeForTrace(content);

      expect(result).not.toContain('4111-1111-1111-1111');
      expect(result).toContain('[CARD]');
    });

    it('should redact credit card numbers without separators', () => {
      const content = 'Card: 4111111111111111';
      const result = sanitizeForTrace(content);

      expect(result).not.toContain('4111111111111111');
      expect(result).toContain('[CARD]');
    });

    it('should allow disabling credit card redaction', () => {
      const content = 'Card: 4111-1111-1111-1111';
      const config: SanitizeConfig = {
        ...DEFAULT_SANITIZE_CONFIG,
        redactPatterns: {
          ...DEFAULT_SANITIZE_CONFIG.redactPatterns,
          creditCard: false,
        },
      };
      const result = sanitizeForTrace(content, config);

      expect(result).toContain('4111-1111-1111-1111');
    });
  });

  describe('SSN Redaction', () => {
    it('should redact SSN with dashes', () => {
      const content = 'SSN: 123-45-6789';
      const result = sanitizeForTrace(content);

      expect(result).not.toContain('123-45-6789');
      expect(result).toContain('[SSN]');
    });

    it('should redact SSN without dashes', () => {
      const content = 'SSN: 123456789';
      const result = sanitizeForTrace(content);

      expect(result).not.toContain('123456789');
      expect(result).toContain('[SSN]');
    });

    it('should allow disabling SSN redaction', () => {
      const content = 'SSN: 123-45-6789';
      const config: SanitizeConfig = {
        ...DEFAULT_SANITIZE_CONFIG,
        redactPatterns: {
          ...DEFAULT_SANITIZE_CONFIG.redactPatterns,
          ssn: false,
        },
      };
      const result = sanitizeForTrace(content, config);

      expect(result).toContain('123-45-6789');
    });
  });

  describe('Custom Pattern Redaction', () => {
    it('should support custom regex patterns', () => {
      const content = 'Account ID: ACC-12345';
      const config: SanitizeConfig = {
        ...DEFAULT_SANITIZE_CONFIG,
        redactPatterns: {
          ...DEFAULT_SANITIZE_CONFIG.redactPatterns,
          customPatterns: [/ACC-\d{5}/g],
        },
      };
      const result = sanitizeForTrace(content, config);

      expect(result).not.toContain('ACC-12345');
      expect(result).toContain('[REDACTED]');
    });

    it('should support multiple custom patterns', () => {
      const content = 'Order ORD-999 by Customer CUST-777';
      const config: SanitizeConfig = {
        ...DEFAULT_SANITIZE_CONFIG,
        redactPatterns: {
          ...DEFAULT_SANITIZE_CONFIG.redactPatterns,
          customPatterns: [/ORD-\d+/g, /CUST-\d+/g],
        },
      };
      const result = sanitizeForTrace(content, config);

      expect(result).not.toContain('ORD-999');
      expect(result).not.toContain('CUST-777');
      expect(result.match(/\[REDACTED\]/g)?.length).toBe(2);
    });
  });

  describe('Combined Redaction', () => {
    it('should redact multiple PII types in same content', () => {
      const content = 'User john@example.com called 555-123-4567 with card 4111-1111-1111-1111';
      const result = sanitizeForTrace(content);

      expect(result).not.toContain('john@example.com');
      expect(result).not.toContain('555-123-4567');
      expect(result).not.toContain('4111-1111-1111-1111');
      expect(result).toContain('[EMAIL]');
      expect(result).toContain('[PHONE]');
      expect(result).toContain('[CARD]');
    });

    it('should truncate after redaction', () => {
      // Long content with PII near the end
      const content = 'a'.repeat(190) + ' email: test@example.com';
      const result = sanitizeForTrace(content);

      // Should truncate to 200 chars and add '...'
      expect(result.length).toBeLessThanOrEqual(203);
      // The email should either be redacted (if within first 200) or truncated
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const result = sanitizeForTrace('');
      expect(result).toBe('');
    });

    it('should handle content with no PII', () => {
      const content = 'This is a regular message with no sensitive info.';
      const result = sanitizeForTrace(content);
      expect(result).toBe(content);
    });

    it('should handle undefined/null gracefully', () => {
      // @ts-expect-error - testing runtime behavior
      const result1 = sanitizeForTrace(undefined);
      // @ts-expect-error - testing runtime behavior
      const result2 = sanitizeForTrace(null);

      expect(result1).toBe('');
      expect(result2).toBe('');
    });

    it('should handle special characters in content', () => {
      const content = 'Special chars: <script>alert("test")</script>';
      const result = sanitizeForTrace(content);
      // Should not throw or corrupt
      expect(result).toContain('Special chars');
    });
  });

  describe('Default Config', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_SANITIZE_CONFIG.maxLength).toBe(200);
      expect(DEFAULT_SANITIZE_CONFIG.redactPatterns.email).toBe(true);
      expect(DEFAULT_SANITIZE_CONFIG.redactPatterns.phone).toBe(true);
      expect(DEFAULT_SANITIZE_CONFIG.redactPatterns.creditCard).toBe(true);
      expect(DEFAULT_SANITIZE_CONFIG.redactPatterns.ssn).toBe(true);
    });
  });
});
