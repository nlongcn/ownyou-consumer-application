/**
 * Data Sanitizer - Prepare raw user data for LLM inference
 *
 * Responsibilities:
 * 1. Filter data by time window
 * 2. Remove PII (emails, phone numbers, addresses)
 * 3. Summarize/truncate to fit context limits
 * 4. Format data for LLM consumption
 *
 * @see docs/sprints/ownyou-sprint6-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 2.4
 */

import type { UserDataBundle } from '../types';

/**
 * Configuration for data sanitization
 */
export interface SanitizeConfig {
  /** Number of days of data to include */
  dataWindowDays: number;
  /** Maximum items per category */
  maxItemsPerCategory: number;
  /** Maximum characters per item summary */
  maxCharsPerItem: number;
  /** Maximum total output characters */
  maxTotalChars: number;
}

const DEFAULT_CONFIG: SanitizeConfig = {
  dataWindowDays: 90,
  maxItemsPerCategory: 50,
  maxCharsPerItem: 200,
  maxTotalChars: 8000,
};

/**
 * PII patterns to remove from text
 */
const PII_PATTERNS = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  // Phone numbers (various formats)
  phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}/g,
  // Credit card numbers
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  // SSN
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  // IP addresses
  ip: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  // Street addresses (simplified)
  address: /\b\d{1,5}\s+[A-Za-z]+\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place)\b/gi,
};

/**
 * Sanitize user data for LLM consumption
 *
 * @param rawData - Raw user data bundle from Store
 * @param dataWindowDays - Number of days of data to include
 * @returns Sanitized string for LLM prompt
 */
export async function sanitizeDataForLLM(
  rawData: UserDataBundle,
  dataWindowDays: number = 90
): Promise<string> {
  const config: SanitizeConfig = {
    ...DEFAULT_CONFIG,
    dataWindowDays,
  };

  const cutoffDate = Date.now() - dataWindowDays * 24 * 60 * 60 * 1000;
  const sections: string[] = [];

  // Process IAB classifications
  if (rawData.iabClassifications.length > 0) {
    const iabSection = processIABClassifications(
      rawData.iabClassifications,
      cutoffDate,
      config
    );
    if (iabSection) {
      sections.push(iabSection);
    }
  }

  // Process emails
  if (rawData.emails.length > 0) {
    const emailSection = processEmails(rawData.emails, cutoffDate, config);
    if (emailSection) {
      sections.push(emailSection);
    }
  }

  // Process financial data (if available)
  if (rawData.financial && rawData.financial.length > 0) {
    const financialSection = processFinancial(
      rawData.financial,
      cutoffDate,
      config
    );
    if (financialSection) {
      sections.push(financialSection);
    }
  }

  // Process calendar data (if available)
  if (rawData.calendar && rawData.calendar.length > 0) {
    const calendarSection = processCalendar(
      rawData.calendar,
      cutoffDate,
      config
    );
    if (calendarSection) {
      sections.push(calendarSection);
    }
  }

  // Combine and truncate if needed
  let result = sections.join('\n\n');

  if (result.length > config.maxTotalChars) {
    result = result.substring(0, config.maxTotalChars) + '\n[Data truncated]';
  }

  return result || 'No data available for the specified time window.';
}

/**
 * Process IAB classification data
 */
function processIABClassifications(
  items: Array<{ key: string; value: unknown }>,
  cutoffDate: number,
  config: SanitizeConfig
): string | null {
  const filtered = filterByDate(items, cutoffDate);

  if (filtered.length === 0) {
    return null;
  }

  const limited = filtered.slice(0, config.maxItemsPerCategory);
  const summaries = limited.map((item) => {
    const val = item.value as Record<string, unknown>;
    const category = val.taxonomy_id || val.category || 'Unknown';
    const confidence = val.confidence ?? 0;
    const source = val.source || 'email';
    const summary = val.summary ? truncate(String(val.summary), config.maxCharsPerItem) : '';

    return `- [${category}] (${Math.round(Number(confidence) * 100)}% confidence) ${summary}`.trim();
  });

  return `## User Interests (IAB Classifications)\n${summaries.join('\n')}`;
}

/**
 * Process email data - extract subject lines and summaries
 */
function processEmails(
  items: Array<{ key: string; value: unknown }>,
  cutoffDate: number,
  config: SanitizeConfig
): string | null {
  const filtered = filterByDate(items, cutoffDate);

  if (filtered.length === 0) {
    return null;
  }

  const limited = filtered.slice(0, config.maxItemsPerCategory);
  const summaries = limited.map((item) => {
    const val = item.value as Record<string, unknown>;
    const subject = sanitizePII(String(val.subject || 'No subject'));
    const sender = val.sender_name
      ? sanitizePII(String(val.sender_name))
      : 'Unknown';
    const date = formatDate(val.date as number | string);
    const summary = val.summary
      ? sanitizePII(truncate(String(val.summary), config.maxCharsPerItem))
      : '';

    return `- [${date}] From: ${sender} - "${subject}"${summary ? ` | ${summary}` : ''}`;
  });

  return `## Email Activity\n${summaries.join('\n')}`;
}

/**
 * Process financial/transaction data
 */
function processFinancial(
  items: Array<{ key: string; value: unknown }>,
  cutoffDate: number,
  config: SanitizeConfig
): string | null {
  const filtered = filterByDate(items, cutoffDate);

  if (filtered.length === 0) {
    return null;
  }

  const limited = filtered.slice(0, config.maxItemsPerCategory);
  const summaries = limited.map((item) => {
    const val = item.value as Record<string, unknown>;
    const merchant = sanitizePII(String(val.merchant || 'Unknown'));
    const category = val.category || 'Uncategorized';
    const amount = val.amount ? `$${Number(val.amount).toFixed(2)}` : '';
    const date = formatDate(val.date as number | string);

    return `- [${date}] ${merchant} (${category})${amount ? ` - ${amount}` : ''}`;
  });

  return `## Transactions\n${summaries.join('\n')}`;
}

/**
 * Process calendar data
 */
function processCalendar(
  items: Array<{ key: string; value: unknown }>,
  cutoffDate: number,
  config: SanitizeConfig
): string | null {
  const filtered = filterByDate(items, cutoffDate);

  if (filtered.length === 0) {
    return null;
  }

  const limited = filtered.slice(0, config.maxItemsPerCategory);
  const summaries = limited.map((item) => {
    const val = item.value as Record<string, unknown>;
    const title = sanitizePII(String(val.title || 'Untitled'));
    const date = formatDate(val.date as number | string);
    const attendees = val.attendees
      ? ` with ${(val.attendees as string[]).length} attendees`
      : '';
    const location = val.location
      ? ` at ${sanitizePII(String(val.location))}`
      : '';

    return `- [${date}] ${title}${attendees}${location}`;
  });

  return `## Calendar Events\n${summaries.join('\n')}`;
}

/**
 * Filter items by date cutoff
 */
function filterByDate(
  items: Array<{ key: string; value: unknown }>,
  cutoffDate: number
): Array<{ key: string; value: unknown }> {
  return items.filter((item) => {
    const val = item.value as Record<string, unknown>;
    const dateValue = val.date || val.created_at || val.timestamp || val.received_at;

    if (!dateValue) {
      return true; // Include items without dates
    }

    const timestamp =
      typeof dateValue === 'number'
        ? dateValue
        : new Date(String(dateValue)).getTime();

    return timestamp >= cutoffDate;
  });
}

/**
 * Remove PII from text
 */
export function sanitizePII(text: string): string {
  let result = text;

  for (const pattern of Object.values(PII_PATTERNS)) {
    result = result.replace(pattern, '[REDACTED]');
  }

  return result;
}

/**
 * Truncate text to max length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format date for display
 */
function formatDate(date: number | string | undefined): string {
  if (!date) {
    return 'Unknown date';
  }

  const timestamp = typeof date === 'number' ? date : new Date(date).getTime();
  const d = new Date(timestamp);

  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
