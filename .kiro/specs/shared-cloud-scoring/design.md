# Design Document: Shared Cloud Scoring

## Overview

This design extends the archery scoring application to support shared scoring through a simple JSON file hosted on GitHub Pages. The feature enables archers to view each other's rounds while maintaining the existing single-file HTML architecture and localStorage-based data persistence.

### Key Design Decisions

1. **GitHub Pages as Static File Host**: The `scores.json` file will be hosted in the same directory as `index.html` on GitHub Pages. This approach leverages existing infrastructure without requiring a backend server.

2. **Read-Only Public Data**: Due to GitHub Pages' static nature, the shared JSON file is effectively read-only from the browser. Archers can view others' scores but cannot directly modify the shared file through the app. Updates to the shared file require manual GitHub commits or GitHub Actions workflows.

3. **Personal/Public View Toggle**: The History tab will feature a toggle allowing archers to switch between viewing their own rounds (Personal) and viewing all other archers' rounds (Public).

4. **Session ID for Deduplication**: Each session will include a unique ID (timestamp-based with random suffix) to prevent duplicates when merging local and remote data.

5. **Graceful Degradation**: The app will continue functioning fully offline, with sync operations failing silently when network is unavailable.

## Architecture

### Data Flow

```
┌─────────────────┐
│  localStorage   │ ◄──── Primary data store (always available)
└────────┬────────┘
         │
         ├──► On App Load: Fetch scores.json → Merge into localStorage
         │
         └──► On Round Complete: Attempt to sync session to scores.json
                                  (requires manual GitHub workflow)

┌─────────────────┐
│  scores.json    │ ◄──── Shared read-only data on GitHub Pages
│  (GitHub Pages) │
└─────────────────┘
```

### Sync Strategy

**On App Load:**
1. Fetch `./scores.json` from GitHub Pages
2. Parse JSON array of sessions
3. Merge sessions into localStorage using session IDs to avoid duplicates
4. If fetch fails (offline/404), continue with local data only

**On Round Completion:**
1. Save session to localStorage (always succeeds)
2. Attempt to fetch current `scores.json`
3. Append/update session in the array
4. Since direct writes aren't possible from browser to GitHub Pages, this step would require:
   - GitHub Actions workflow triggered by API
   - Or manual commit process
   - Or alternative: Display "Share" button that generates JSON for manual upload

**Practical Implementation Note:** Given GitHub Pages constraints, the most practical approach is:
- App saves all data to localStorage
- Provide an "Export for Sharing" feature that generates the JSON
- User manually commits the updated `scores.json` to the repository
- Other users fetch the updated file on next app load

### Migration Strategy

**First-Time Setup:**
1. Detect if `archerName` field is missing from existing sessions
2. Prompt user to set their archer name
3. Add `archerName` to all existing sessions
4. Generate unique `sessionId` for sessions that lack one
5. Mark migration as complete in localStorage

## Components and Interfaces

### Data Models

#### Session Object (Enhanced)
```javascript
{
  id: number,              // Unique session ID (timestamp + random)
  archerName: string,      // NEW: Archer's display name
  type: string,            // 'bullseye_tournament' | '3d_tournament' | 'practice'
  date: string,            // ISO 8601 timestamp
  location: string | null,
  rounds: Array<Round>,
  currentRound: Round,
  // ... existing fields
}
```

#### scores.json Structure
```javascript
{
  "version": "1.0",
  "lastUpdated": "2024-01-15T10:30:00Z",
  "sessions": [
    {
      "id": 1705315800123,
      "archerName": "Alice",
      "type": "bullseye_tournament",
      "date": "2024-01-15T10:00:00Z",
      "location": "Range A",
      "rounds": [...]
    },
    // ... more sessions
  ]
}
```

### UI Components

#### Archer Name Management
- **Location**: Settings or profile section
- **Input**: Text field with validation (max 40 chars, trimmed)
- **Storage**: `db.deviceProfile.activeArcher`
- **Behavior**: Applied to all new sessions automatically

#### History Tab Toggle
- **Component**: Segmented control with "Personal" and "Public" options
- **Location**: Top of History tab, below search/filter bar
- **State**: Persisted in localStorage as `historyViewMode`
- **Default**: "Personal"

#### Session List Filtering
- **Personal View**: Filter sessions where `session.archerName === db.deviceProfile.activeArcher`
- **Public View**: Filter sessions where `session.archerName !== db.deviceProfile.activeArcher`
- **All existing filters** (date, location, search) apply to the filtered set

#### Round Detail Overlay (Enhanced)
- **Display archer name** prominently at top
- **Show all round details** (arrows, scores, metadata)
- **Hide edit/delete buttons** when viewing others' sessions
- **Show print button** for all sessions

### API/Network Layer

#### Fetch scores.json
```javascript
async function fetchSharedScores() {
  try {
    const response = await fetch('./scores.json', {
      cache: 'no-cache',
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn('Failed to fetch shared scores:', error);
    return null;
  }
}
```

#### Merge Strategy
```javascript
function mergeSharedSessions(sharedData) {
  if (!sharedData?.sessions) return;
  
  const existingIds = new Set(db.sessions.map(s => s.id));
  const newSessions = sharedData.sessions.filter(s => !existingIds.has(s.id));
  
  db.sessions.push(...newSessions.map(normalizeSessionData));
  save();
}
```

### Session ID Generation

```javascript
function generateSessionId() {
  // Timestamp + random 4-digit suffix for collision avoidance
  return Date.now() * 10000 + Math.floor(Math.random() * 10000);
}
```

This ensures uniqueness even if multiple archers create sessions at the same millisecond.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified several areas where properties can be consolidated:

- **Filter/Sort Compatibility (4.1-4.4)**: These four properties all test that existing filters work in both views. They can be combined into a single comprehensive property about filter preservation across view modes.
- **Round Detail Display (5.2-5.5)**: These properties all test that the detail overlay contains required information. They can be combined into one property about complete session data display.
- **Merge Operations (6.2, 6.3, 7.2, 7.3, 7.4)**: These properties overlap significantly in testing merge behavior. They can be consolidated into properties about merge correctness and preservation.
- **Edit/Delete Protection (10.1, 10.2, 10.3, 10.7)**: These properties all relate to ownership-based access control and can be combined.

### Property 1: Archer Name Persistence

*For any* valid archer name, storing it in the device profile and then retrieving it from localStorage should return the same name.

**Validates: Requirements 1.2**

### Property 2: Session Tagging with Archer Name

*For any* archer name and session creation operation, the created session should have its archerName field set to the current archer name from the device profile.

**Validates: Requirements 1.3**

### Property 3: Future Sessions Use Updated Name

*For any* sequence of archer name changes and session creations, sessions created after a name change should have the new archer name, not the old one.

**Validates: Requirements 1.5**

### Property 4: Shared JSON Structure Validity

*For any* generated scores.json content, parsing it should yield an object with a "sessions" array containing valid session objects.

**Validates: Requirements 2.2**

### Property 5: Session Objects Have Required Fields

*For any* session object in the system, it should have an archerName field, a unique id field, and a date field with a valid ISO 8601 timestamp.

**Validates: Requirements 2.3, 2.4, 2.5**

### Property 6: Session ID Uniqueness

*For any* collection of sessions in the system, all session IDs should be unique (no duplicates).

**Validates: Requirements 2.4**

### Property 7: Personal View Filtering

*For any* set of sessions and current archer name, filtering with "Personal" view should return only sessions where archerName matches the current archer, and no sessions where it doesn't match.

**Validates: Requirements 3.2**

### Property 8: Public View Filtering

*For any* set of sessions and current archer name, filtering with "Public" view should return only sessions where archerName does NOT match the current archer, and no sessions where it does match.

**Validates: Requirements 3.3**

### Property 9: Toggle State Persistence

*For any* toggle state ("Personal" or "Public"), storing it in localStorage and then retrieving it should return the same state.

**Validates: Requirements 3.4**

### Property 10: Filters Work in Both Views

*For any* filter configuration (date, location, search, sort) and view mode (Personal or Public), applying the filters should correctly filter the view-specific session set, and switching views should preserve the filter settings.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

### Property 11: Round Detail Displays Complete Information

*For any* session, the round detail overlay should display the archerName, all arrow scores for each round, the total score, and the session type and metadata.

**Validates: Requirements 5.2, 5.3, 5.4, 5.5**

### Property 12: Merge Preserves Existing Sessions

*For any* existing local sessions and incoming shared sessions, merging should preserve all existing local sessions and add only new sessions (based on session ID) without creating duplicates.

**Validates: Requirements 6.2, 6.3, 7.2, 7.3, 7.4**

### Property 13: Migration Detects Unmigrated Sessions

*For any* collection of sessions, the migration detection function should correctly identify all sessions that lack an archerName field.

**Validates: Requirements 8.1**

### Property 14: Migration Adds Archer Name

*For any* sessions without archerName field, running migration should add the current archer name to those sessions while preserving all other session data.

**Validates: Requirements 8.2, 8.5**

### Property 15: Migration Idempotency

*For any* collection of sessions, running migration multiple times should not re-migrate sessions that already have an archerName field, and should not corrupt or duplicate data.

**Validates: Requirements 8.4**

### Property 16: Offline Session Persistence

*For any* session created while offline, the session should be successfully saved to localStorage and retrievable afterward.

**Validates: Requirements 9.3**

### Property 17: Ownership-Based Access Control

*For any* session, edit and delete operations should be allowed only when the session's archerName matches the current archer, and should be blocked otherwise. In Public view, edit and delete UI controls should not be displayed for any session.

**Validates: Requirements 10.1, 10.2, 10.3, 10.7**

### Property 18: Universal View and Print Access

*For any* session in either Personal or Public view, the print function and detail view should be accessible and functional.

**Validates: Requirements 10.4, 10.5**

### Property 19: Universal Filter Access

*For any* session in either Personal or Public view, all filter, sort, and search functions should be available and work correctly.

**Validates: Requirements 10.6**

## Error Handling

### Network Failures

**Fetch Failures:**
- When `fetch('./scores.json')` fails (network error, 404, timeout), the app continues with local data only
- No error messages displayed to user
- Retry on next app load or round completion

**Write Failures:**
- Since GitHub Pages doesn't support direct writes from browser, the practical approach is:
  - Provide "Export for Sharing" button that generates JSON
  - User manually commits to repository
  - No automatic write failures to handle

### Data Validation

**Invalid Shared Data:**
- If `scores.json` is malformed JSON, catch parse error and continue with local data
- If `scores.json` has invalid structure (missing sessions array), ignore and continue
- If individual sessions have invalid fields, normalize them using existing `normalizeSessionData` function

### Migration Errors

**Missing Archer Name:**
- If user hasn't set archer name when migration runs, prompt for name before migrating
- If user cancels, defer migration to next app load
- Never migrate sessions without a valid archer name

### Conflict Resolution

**Session ID Collisions:**
- Extremely unlikely due to timestamp + random suffix
- If collision detected during merge, keep local version and log warning
- Remote version is ignored

**Archer Name Conflicts:**
- No conflicts possible - each device has its own archer name
- Sessions are immutable once created (except during migration)

## Testing Strategy

### Dual Testing Approach

This feature will use both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** will focus on:
- Specific examples of UI interactions (toggle clicks, button visibility)
- Edge cases (empty sessions list, missing fields, malformed JSON)
- Integration points (localStorage operations, fetch mocking)
- Migration scenarios (first-time setup, already migrated)

**Property-Based Tests** will focus on:
- Universal properties across all inputs (filtering, merging, access control)
- Data integrity (session ID uniqueness, field presence)
- Round-trip properties (localStorage persistence, JSON serialization)
- Comprehensive input coverage through randomization

### Property-Based Testing Configuration

**Library**: Use `fast-check` for JavaScript property-based testing

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with: `Feature: shared-cloud-scoring, Property {number}: {property_text}`

**Example Test Structure**:
```javascript
// Feature: shared-cloud-scoring, Property 6: Session ID Uniqueness
fc.assert(
  fc.property(
    fc.array(sessionGenerator(), { minLength: 0, maxLength: 100 }),
    (sessions) => {
      const ids = sessions.map(s => s.id);
      const uniqueIds = new Set(ids);
      return ids.length === uniqueIds.size;
    }
  ),
  { numRuns: 100 }
);
```

### Unit Test Focus Areas

1. **UI Component Tests**:
   - Toggle renders with Personal/Public options
   - Edit/delete buttons hidden in Public view
   - Archer name input field exists and validates

2. **Edge Case Tests**:
   - Empty sessions array
   - Sessions without archerName field
   - Malformed scores.json
   - Network timeout scenarios

3. **Integration Tests**:
   - Fetch mock returns valid/invalid data
   - localStorage operations succeed
   - Migration runs on first load

### Test Data Generators

For property-based tests, create generators for:
- Valid archer names (1-40 chars, trimmed)
- Session objects with all required fields
- Round objects with arrow scores
- scores.json structures
- Filter configurations (date ranges, locations, search queries)

