/**
 * @ownyou/data-calendar - Sprint 8
 *
 * Calendar data connector for OwnYou.
 * Integrates with Google Calendar and Microsoft Graph Calendar APIs,
 * normalizes events, classifies them with IAB categories, and extracts
 * relationship signals for Ikigai.
 */

// Types
export * from './types.js';

// Providers
export { MockCalendarClient, createMockCalendarClient, MOCK_ATTENDEES, MOCK_EVENT_TEMPLATES } from './providers/mock.js';

// Pipeline
export {
  normalizeGoogleEvent,
  normalizeMicrosoftEvent,
  classifyEventType,
  calculateEventDuration,
  isEventPast,
  isRecurringEvent,
  getEventsOnDate,
  getWeekendEvents,
  getEventsByType,
} from './pipeline/normalizer.js';

export { CalendarEventFetcher, createCalendarFetcher, type CalendarFetcherConfig } from './pipeline/fetcher.js';

export {
  CalendarEventClassifier,
  createCalendarClassifier,
  getIkigaiEvents,
  getEventTypeDistribution,
  type ClassifierConfig,
} from './pipeline/classifier.js';

export {
  extractFrequentContacts,
  extractSharedEventPatterns,
  detectBusyTimePatterns,
  detectFreeWeekends,
  getUniqueAttendeesCount,
  calculateAverageEventsPerWeek,
  type RelationshipExtractorConfig,
} from './pipeline/relationship-extractor.js';

// Store
export {
  CalendarStore,
  createCalendarStore,
  type Store,
  type CalendarStoreConfig,
} from './store/persistence.js';
