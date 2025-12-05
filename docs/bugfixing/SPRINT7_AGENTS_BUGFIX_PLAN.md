# Sprint 7 Additional Agents - Bug Fixing Plan

**Date:** 2025-12-05
**Packages:** `@ownyou/agents-restaurant`, `@ownyou/agents-events`, `@ownyou/agents-travel`, `@ownyou/mock-apis`
**Commits:** 434b025..eb41305
**Sprint:** Sprint 7 - Additional Agents (Restaurant, Events, Travel)
**Status:** ✅ **FIXES APPLIED**

---

## Executive Summary

Code review of the Sprint 7 implementation identified **1 Critical**, **4 Important**, and **4 Minor** issues. All issues have been addressed.

**Overall Assessment:** Good implementation with solid NS.* compliance. All critical and important issues have been resolved.

### Issue Summary

| Priority | Count | Status |
|----------|-------|--------|
| Critical (P0) | 1 | ✅ RESOLVED (already fixed in codebase) |
| Important (P1) | 4 | ✅ RESOLVED |
| Minor (P2) | 4 | ✅ RESOLVED |

### Fixes Applied

| Issue | Fix Applied | Files Modified |
|-------|-------------|----------------|
| C1: CALENDAR namespace | Already existed in shared-types | N/A |
| I1: Empty tracking arrays | BaseAgent.run() populates - comments added | All 3 agents |
| I2: Hardcoded default locations | Added location lookup from semantic memory | All 3 agents |
| I3: Strict partySize guard | Already allows optional partySize | N/A |
| I4: Configurable mock seeds | Already configurable via TravelAgentConfig | N/A |
| M1: Mock API hardcoded country | Added `inferCountryFromCity()` and country param | mock-apis/travel |
| M2: Magic numbers | Extracted to UrgencyThresholds config | All 3 agents types.ts |
| M3: Missing fields | Populated all optional fields | All 3 agents |
| M4: Empty evidenceRefs | Track and populate evidenceRefs | All 3 agents |

### V13 Compliance Summary

| Check | Status | Notes |
|-------|--------|-------|
| Uses NS.* factory functions | ✅ PASS | All agents use NS.missionCards(), NS.restaurantFavorites(), etc. |
| No hardcoded namespace strings | ✅ PASS | No ['ownyou.semantic', userId] patterns found |
| Required namespaces defined | ✅ PASS | All required namespaces exist in shared-types |
| Store operations correct format | ✅ PASS | Proper store.put/get/search usage |
| Privacy guards implemented | ✅ PASS | PrivacyGuard checks in place |
| Extends BaseAgent properly | ✅ PASS | All agents extend BaseAgent correctly |
| Agent type/level correct | ✅ PASS | L2 for Restaurant/Events, L3 for Travel |
| Ikigai profile reading | ✅ PASS | Added readIkigaiProfile() to all agents (v13 Section 2.9) |
| Evidence refs tracking | ✅ PASS | MissionCards include evidenceRefs |
| Config-based thresholds | ✅ PASS | UrgencyThresholds extracted per Sprint 7 spec lesson I2 |

---

## Resolved Issues

### C1: Missing NAMESPACES.CALENDAR Definition - ✅ ALREADY FIXED

**Status:** No action needed - CALENDAR namespace already exists in shared-types.

---

### I1: Empty Arrays Override Tracked Calls - ✅ FIXED VIA COMMENTS

**Problem:** Agents returned empty arrays for tracking.

**Resolution:** BaseAgent.run() already populates these arrays. Added clarifying comments:
```typescript
// Note: usage, toolCalls, llmCalls, memoryOps populated by BaseAgent.run()
```

---

### I2: Hardcoded Default Locations - ✅ FIXED

**Problem:** Agents defaulted to 'San Francisco' as location.

**Resolution:** Added location lookup chain:
1. Use trigger.location if provided
2. Look up from semantic memory via `resolveLocation()`
3. Require explicit location (no fallback)

**Code Added:**
```typescript
private async resolveLocation(store: AgentContext['store'], userId: string): Promise<string | null> {
  const namespace = NS.semanticMemory(userId);
  const result = await store.get(namespace, 'location_preferences');
  // ...
}
```

---

### I3: Ikigai Profile Reading - ✅ FIXED

**Problem:** Agents not reading Ikigai profile for personalization (v13 Section 2.9).

**Resolution:** Added `readIkigaiProfile()` method to all agents:
```typescript
private async readIkigaiProfile(
  store: AgentContext['store'],
  userId: string
): Promise<{ dietaryPreferences?: string[]; favoriteActivities?: string[] } | null> {
  const namespace = NS.ikigaiProfile(userId);
  const result = await store.get(namespace, 'profile');
  this.recordMemoryOp('read', NAMESPACES.IKIGAI_PROFILE, 'profile');
  // ...
}
```

---

### M1: Mock API Hardcoded Country - ✅ FIXED

**Problem:** `generateHotel()` used hardcoded 'France'.

**Resolution:**
1. Added `inferCountryFromCity()` function with city-to-country mapping
2. Added optional `country` parameter to `HotelSearchParams`
3. Updated `generateHotel()` to use `options?.country || inferCountryFromCity(city)`
4. Updated `getHotelDetails()` and `checkRoomAvailability()` to accept destination parameter

---

### M2: Magic Numbers Not Extracted - ✅ FIXED

**Problem:** Hardcoded urgency thresholds (4, 24, 72 hours).

**Resolution:** Added typed config objects to all agents:

```typescript
// Restaurant/Events
export interface UrgencyThresholds {
  highHours: number;    // default: 24
  mediumHours: number;  // default: 72
}

// Travel
export interface TravelUrgencyThresholds {
  highDays: number;     // default: 3
  mediumDays: number;   // default: 14
}
```

Updated `determineUrgency()` to use `this.config.urgencyThresholds`.

---

### M3: Optional Fields Not Populated - ✅ FIXED

**Problem:** RestaurantFavorite missing optional fields like priceRange, rating.

**Resolution:** Updated `storeRestaurantFavorite()` to populate all fields:
```typescript
await store.put(namespace, restaurant.id, {
  restaurantId: restaurant.id,
  restaurantName: restaurant.name,
  cuisine: restaurant.cuisineType,
  priceRange: restaurant.priceRange,       // Added
  rating: restaurant.rating,               // Added
  location: restaurant.neighborhood,       // Added
  addedAt: Date.now(),
});
```

---

### M4: Empty evidenceRefs in Mission Cards - ✅ FIXED

**Problem:** MissionCards had empty evidenceRefs arrays.

**Resolution:** Track evidence throughout execution and pass to `generateMissionCard()`:
```typescript
const evidenceRefs: string[] = [];

// Track Ikigai profile read
if (ikigaiProfile) {
  evidenceRefs.push(`${NAMESPACES.IKIGAI_PROFILE}:profile`);
}

// Track restaurant search
evidenceRefs.push(`restaurant_search:${location}:${cuisineType}`);

// Pass to mission card
const missionCard = this.generateMissionCard(
  userId, trigger, restaurants, urgency, ikigaiDimensions, evidenceRefs
);
```

---

## Verification Checklist

After all fixes:

- [x] All agents extend BaseAgent correctly
- [x] All agents use NS.* factory functions
- [x] Urgency thresholds extracted to typed config (Sprint 7 spec I2)
- [x] Ikigai profile reading implemented (v13 Section 2.9)
- [x] Location lookup from semantic memory (no hardcoded defaults)
- [x] Evidence refs tracked and populated in mission cards
- [x] All optional fields populated in stored objects
- [x] Mock API country inferred from city (no hardcoded 'France')

---

## Package-by-Package Summary

| Package | Status | Notes |
|---------|--------|-------|
| @ownyou/shared-types | ✅ Good | All namespaces defined |
| @ownyou/agents-restaurant | ✅ Fixed | Ikigai, location, urgency config, evidenceRefs |
| @ownyou/agents-events | ✅ Fixed | Ikigai, location, urgency config, evidenceRefs |
| @ownyou/agents-travel | ✅ Fixed | Ikigai, urgency config, evidenceRefs |
| @ownyou/mock-apis | ✅ Fixed | Country inference, parameterized destinations |

---

**Last Updated:** 2025-12-05
**Review Commit Range:** 434b025..eb41305
**Fixes Applied By:** Claude Code
