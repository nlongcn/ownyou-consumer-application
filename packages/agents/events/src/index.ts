/**
 * @ownyou/agents-events - Events Agent
 *
 * L2 agent for event discovery, calendar integration,
 * and ticket booking (mock).
 *
 * @see docs/sprints/ownyou-sprint7-spec.md
 */

export { EventsAgent } from './agent';
export {
  EVENTS_PERMISSIONS,
  type EventsTriggerData,
  type Event,
  type Venue,
  type CalendarEvent,
  type EventTicket,
  type EventFavorite,
  type EventCategory,
} from './types';
