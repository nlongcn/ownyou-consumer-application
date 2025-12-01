# Profile Management - Testing Guide

**Date:** 2025-01-12
**Phase:** Phase 1 - Minimal Testing Support
**Status:** ✅ COMPLETE

---

## Overview

This guide explains how to test with different user profiles and reset profiles for fresh testing.

**Key Features:**
- Switch between different user profiles via URL parameter
- Reset/clear all data for a specific profile
- View profile statistics (episodic, semantic, profile counts)

---

## Usage

### Switching User Profiles

All admin dashboard pages now support a `user_id` URL parameter:

```bash
# Default user (if no parameter provided)
http://localhost:3001/profile
http://localhost:3001/analyze
http://localhost:3001/classifications
http://localhost:3001/emails

# Test user 1
http://localhost:3001/profile?user_id=test_user_1
http://localhost:3001/analyze?user_id=test_user_1
http://localhost:3001/classifications?user_id=test_user_1
http://localhost:3001/emails?user_id=test_user_1

# Test user 2
http://localhost:3001/profile?user_id=test_user_2
http://localhost:3001/analyze?user_id=test_user_2
http://localhost:3001/classifications?user_id=test_user_2
http://localhost:3001/emails?user_id=test_user_2

# Any custom user ID
http://localhost:3001/profile?user_id=alice
http://localhost:3001/profile?user_id=bob
```

### Resetting a Profile

**Method 1: Profile Page Button**

1. Navigate to profile page with user_id: `http://localhost:3001/profile?user_id=test_user_1`
2. Click the red **"Reset Profile"** button in the top-right corner
3. Confirm the deletion in the browser dialog
4. Page will reload automatically after reset

**Method 2: Programmatic (Browser Console)**

```javascript
// Import utilities
import { IndexedDBStore } from '@/lib/IndexedDBStore'
import { clearUserProfile } from '../../../browser/store/profileUtils'

// Clear a specific user profile
const store = new IndexedDBStore({ dbName: 'ownyou_store', version: 1 })
const deletedCount = await clearUserProfile(store, 'test_user_1')
console.log(`Deleted ${deletedCount} items`)
```

---

## Testing Scenarios

### Scenario 1: Fresh Profile Testing

**Goal:** Test classification workflow with a clean profile

**Steps:**
1. Navigate to `http://localhost:3001/profile?user_id=fresh_test`
2. Verify profile is empty (no data)
3. Navigate to `http://localhost:3001/analyze?user_id=fresh_test`
4. Run classification on some text or emails
5. Navigate back to profile page
6. Verify classifications appear

### Scenario 2: Profile Reset Testing

**Goal:** Verify reset functionality works correctly

**Steps:**
1. Navigate to `http://localhost:3001/profile?user_id=reset_test`
2. Run some classifications (use analyze page)
3. Verify data exists in profile page
4. Click **"Reset Profile"** button
5. Confirm deletion
6. Verify all data is cleared (page reloads, profile empty)

### Scenario 3: Multiple Profile Comparison

**Goal:** Compare classification results across different profiles

**Steps:**
1. Create profile A: `http://localhost:3001/analyze?user_id=profile_a`
   - Classify with `model=gpt-4o-mini`
2. Create profile B: `http://localhost:3001/analyze?user_id=profile_b`
   - Classify same text with `model=claude-3-5-sonnet`
3. Compare profiles:
   - Profile A: `http://localhost:3001/profile?user_id=profile_a`
   - Profile B: `http://localhost:3001/profile?user_id=profile_b`
4. Analyze classification differences

### Scenario 4: Email Download with Different Users

**Goal:** Download emails for multiple user profiles

**Steps:**
1. Navigate to `http://localhost:3001/emails?user_id=user_1`
2. Connect Gmail/Outlook
3. Download 10 emails
4. Classify emails
5. View profile: `http://localhost:3001/profile?user_id=user_1`
6. Repeat for `user_2` with different email account

---

## Implementation Details

### Files Modified

**1. Profile Page** (`src/admin-dashboard/app/profile/page.tsx`)
- Added `useSearchParams()` to read `user_id` from URL
- Added `handleResetProfile()` function
- Added "Reset Profile" button in header
- Shows current user_id in header

**2. Analyze Page** (`src/admin-dashboard/app/analyze/page.tsx`)
- Added `useSearchParams()` to read `user_id` from URL
- Initializes `userId` state from URL parameter

**3. Classifications Page** (`src/admin-dashboard/app/classifications/page.tsx`)
- Added `useSearchParams()` to read `user_id` from URL
- Initializes `userId` state from URL parameter

**4. Emails Page** (`src/admin-dashboard/app/emails/page.tsx`)
- Reads `user_id` from URL parameter
- Replaced all hardcoded `'default_user'` with `userId` variable
- Affects 3 locations:
  - Line 105: IndexedDB search namespace
  - Line 697: buildWorkflowGraph userId
  - Line 711: workflowInput.user_id

**5. Profile Utilities** (`src/browser/store/profileUtils.ts`) - NEW FILE
- `clearUserProfile(store, userId)` - Delete all data for user
- `listUserProfiles(store)` - Get all unique user IDs
- `getProfileStats(store, userId)` - Get item counts
- `profileExists(store, userId)` - Check if profile has data

### Namespace Structure

All user data is stored in IndexedDB with the following namespace:

```typescript
[user_id, "iab_taxonomy_profile"]   // IAB classifications
```

**Example for `test_user_1`:**
```typescript
["test_user_1", "iab_taxonomy_profile"]   // IAB classifications
```

### Reset Functionality

The `clearUserProfile()` function:

1. Searches all items in `[user_id, "iab_taxonomy_profile"]`
2. Deletes each item individually
3. Returns total count of deleted items

**Note:** Uses existing `search()` and `delete()` methods from IndexedDBStore. No modifications to IndexedDBStore needed.

---

## Utility Functions

### Clear User Profile

```typescript
import { IndexedDBStore } from '@/lib/IndexedDBStore'
import { clearUserProfile } from '../../../browser/store/profileUtils'

const store = new IndexedDBStore('ownyou_store')
const deletedCount = await clearUserProfile(store, 'test_user_1')
// Returns: number of items deleted (all IAB classifications)
```

### List All User Profiles

```typescript
import { listUserProfiles } from '../../../browser/store/profileUtils'

const userIds = await listUserProfiles(store)
// Returns: ['default_user', 'test_user_1', 'test_user_2', 'alice', 'bob']
```

### Get Profile Statistics

```typescript
import { getProfileStats } from '../../../browser/store/profileUtils'

const stats = await getProfileStats(store, 'test_user_1')
// Returns: {
//   classificationsCount: 35,
//   totalCount: 35
// }
```

### Check if Profile Exists

```typescript
import { profileExists } from '../../../browser/store/profileUtils'

const exists = await profileExists(store, 'test_user_1')
// Returns: true if profile has any data, false if empty
```

---

## Troubleshooting

### Issue: Profile page shows old data after reset

**Solution:** Hard refresh the browser (Cmd+Shift+R or Ctrl+Shift+R)

### Issue: Different pages show different user_id

**Cause:** Each page reads `user_id` from URL independently

**Solution:** Always include `?user_id=xxx` in the URL when navigating

### Issue: Classification writes to wrong user

**Cause:** user_id mismatch between URL parameter and form input

**Solution:** Verify the analyze page has correct user_id in both URL and form

### Issue: Reset doesn't delete all items

**Cause:** Limit of 10,000 items per namespace in search

**Solution:** If profile has >10,000 items, call `clearUserProfile()` multiple times

---

## Future Enhancements (Phase 2)

The following features are planned for Phase 2 (Full Profile Management):

### 1. Profile Selector Component
- Dropdown showing all existing profiles
- "New Profile" button
- Profile metadata (name, creation date, item counts)

### 2. Profile Management Page
- List all profiles with statistics
- Create/delete/rename profiles
- Import/export profile data
- Bulk operations

### 3. Bulk Clear Method
- Add `clearNamespace()` to IndexedDBStore
- More efficient than iterating with `delete()`
- Single transaction for all deletions

**See:** `/tmp/profile_management_analysis.md` for detailed Phase 2 plan

---

## Testing Checklist

Before marking profile management as complete:

- [ ] Profile page accepts `user_id` URL parameter
- [ ] Analyze page accepts `user_id` URL parameter
- [ ] Classifications page accepts `user_id` URL parameter
- [ ] Emails page accepts `user_id` URL parameter
- [ ] Reset button appears on profile page
- [ ] Reset button deletes all profile data
- [ ] Reset shows success message
- [ ] Page reloads after reset
- [ ] Multiple profiles can coexist (no conflicts)
- [ ] URL parameter defaults to 'default_user'

---

## Status

**Implementation:** ✅ COMPLETE (Phase 1 - Minimal Testing Support)
**Testing:** ⏳ PENDING (User validation needed)
**Documentation:** ✅ COMPLETE

**Next Steps:**
1. Manual testing with multiple profiles
2. Verify reset functionality
3. Test profile switching across pages
4. Update CLAUDE.md if patterns proven successful

---

**Last Updated:** 2025-01-12
**Author:** Claude (AI Assistant)
**Phase:** Phase 1.5 (Admin Dashboard Migration) - Week 2/4
