# Implementation Plan: Shared Cloud Scoring

## Overview

This plan implements shared scoring functionality for the archery scoring app by adding archer name management, Personal/Public view toggle in the History tab, session ID generation, fetch/merge logic for scores.json, migration for existing sessions, and access control for edit/delete operations. The implementation maintains the single-file HTML architecture with inline JavaScript.

## Tasks

- [x] 1. Set up data model and session ID generation
  - Add `archerName` and `sessionId` fields to session objects
  - Implement `generateSessionId()` function using timestamp + random suffix
  - Update session creation logic to include both fields
  - _Requirements: 1.3, 2.3, 2.4, 2.5_

- [x] 1.1 Write property test for session ID generation
  - **Property 6: Session ID Uniqueness**
  - **Validates: Requirements 2.4**

- [ ] 2. Implement archer name management
  - [x] 2.1 Add archer name storage to device profile
    - Create `db.deviceProfile.activeArcher` field
    - Implement getter/setter functions for archer name
    - Add validation (max 40 chars, trimmed)
    - _Requirements: 1.2_
  
  - [x] 2.2 Write property tests for archer name persistence
    - **Property 1: Archer Name Persistence**
    - **Validates: Requirements 1.2**
  
  - [x] 2.3 Add archer name input UI in settings/profile section
    - Create inline field with label and input
    - Wire up to device profile storage
    - Display current archer name if set
    - _Requirements: 1.1, 1.4_
  
  - [x] 2.4 Update session creation to tag with archer name
    - Modify `createSession()` to include `archerName` from device profile
    - Ensure all session types (tournament, practice, quick score) are tagged
    - _Requirements: 1.3_
  
  - [x] 2.5 Write property tests for session tagging
    - **Property 2: Session Tagging with Archer Name**
    - **Property 3: Future Sessions Use Updated Name**
    - **Validates: Requirements 1.3, 1.5**

- [x] 3. Checkpoint - Verify archer name and session ID functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement History tab Personal/Public toggle
  - [x] 4.1 Create toggle UI component
    - Add segmented control with "Personal" and "Public" options
    - Position at top of History tab
    - Style to match existing UI patterns
    - _Requirements: 3.1_
  
  - [x] 4.2 Implement toggle state management
    - Store toggle state in localStorage as `historyViewMode`
    - Default to "Personal" on first use
    - Restore state on app load
    - _Requirements: 3.4, 3.5_
  
  - [x] 4.3 Write property test for toggle state persistence
    - **Property 9: Toggle State Persistence**
    - **Validates: Requirements 3.4**
  
  - [x] 4.4 Implement session filtering logic
    - Create `filterSessionsByView()` function
    - Personal view: filter where `session.archerName === activeArcher`
    - Public view: filter where `session.archerName !== activeArcher`
    - _Requirements: 3.2, 3.3_
  
  - [x] 4.5 Write property tests for view filtering
    - **Property 7: Personal View Filtering**
    - **Property 8: Public View Filtering**
    - **Validates: Requirements 3.2, 3.3**
  
  - [x] 4.6 Wire toggle to session list rendering
    - Update History tab render logic to use filtered sessions
    - Ensure toggle changes trigger re-render
    - Preserve existing filter/sort/search functionality
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 4.7 Write property test for filter compatibility
    - **Property 10: Filters Work in Both Views**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

- [x] 5. Checkpoint - Verify toggle and filtering functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement scores.json fetch and merge logic
  - [x] 6.1 Create fetchSharedScores() function
    - Implement fetch to `./scores.json` with no-cache headers
    - Handle 404, network errors, and timeouts gracefully
    - Return null on failure
    - _Requirements: 7.1, 7.5_
  
  - [x] 6.2 Create mergeSharedSessions() function
    - Parse shared data and validate structure
    - Filter out sessions with duplicate IDs
    - Append new sessions to local storage
    - Use existing `normalizeSessionData()` for validation
    - _Requirements: 7.2, 7.3, 7.4_
  
  - [x] 6.3 Write property tests for merge logic
    - **Property 12: Merge Preserves Existing Sessions**
    - **Validates: Requirements 6.2, 6.3, 7.2, 7.3, 7.4**
  
  - [x] 6.3 Wire fetch/merge to app load
    - Call `fetchSharedScores()` on app initialization
    - Call `mergeSharedSessions()` with fetched data
    - Continue with local data if fetch fails
    - _Requirements: 7.1, 7.5_
  
  - [x] 6.4 Write property test for shared JSON structure
    - **Property 4: Shared JSON Structure Validity**
    - **Property 5: Session Objects Have Required Fields**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5**

- [ ] 7. Implement migration for existing sessions
  - [x] 7.1 Create migration detection function
    - Check for sessions without `archerName` field
    - Check migration flag in localStorage
    - _Requirements: 8.1, 8.4_
  
  - [x] 7.2 Write property test for migration detection
    - **Property 13: Migration Detects Unmigrated Sessions**
    - **Validates: Requirements 8.1**
  
  - [x] 7.3 Create migration function
    - Prompt user for archer name if not set
    - Add `archerName` to all sessions without it
    - Generate `sessionId` for sessions that lack one
    - Set migration complete flag in localStorage
    - _Requirements: 8.2, 8.3, 8.4, 8.5_
  
  - [x] 7.4 Write property tests for migration
    - **Property 14: Migration Adds Archer Name**
    - **Property 15: Migration Idempotency**
    - **Validates: Requirements 8.2, 8.4, 8.5**
  
  - [x] 7.5 Wire migration to app load
    - Run migration check on app initialization
    - Execute migration if needed before rendering UI
    - _Requirements: 8.1_

- [x] 8. Checkpoint - Verify fetch, merge, and migration functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement access control for edit/delete operations
  - [x] 9.1 Update round detail overlay
    - Display archer name prominently at top
    - Hide edit/delete buttons when viewing others' sessions
    - Check `session.archerName !== activeArcher` to determine ownership
    - _Requirements: 10.1, 10.2, 10.3, 10.7_
  
  - [x] 9.2 Write property tests for access control
    - **Property 17: Ownership-Based Access Control**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.7**
  
  - [x] 9.3 Ensure print and view features work for all sessions
    - Verify print button is visible for all sessions
    - Verify detail view is accessible for all sessions
    - _Requirements: 10.4, 10.5_
  
  - [x] 9.4 Write property tests for universal access
    - **Property 18: Universal View and Print Access**
    - **Property 19: Universal Filter Access**
    - **Validates: Requirements 10.4, 10.5, 10.6**
  
  - [x] 9.5 Add session owner display in round detail
    - Create session owner row component
    - Display archer name with label
    - Style to match existing UI patterns
    - _Requirements: 5.2_
  
  - [x] 9.6 Write property test for round detail display
    - **Property 11: Round Detail Displays Complete Information**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**

- [ ] 10. Implement offline support and error handling
  - [x] 10.1 Add error handling to fetch operations
    - Catch and log fetch errors without displaying to user
    - Continue with local data on fetch failure
    - _Requirements: 9.2, 9.4_
  
  - [x] 10.2 Ensure localStorage operations always succeed
    - Verify sessions save to localStorage regardless of network state
    - Test offline session creation
    - _Requirements: 9.1, 9.3_
  
  - [x] 10.3 Write property test for offline persistence
    - **Property 16: Offline Session Persistence**
    - **Validates: Requirements 9.3**

- [x] 11. Final checkpoint and integration testing
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The implementation maintains the single-file HTML architecture with inline JavaScript
- All data operations use localStorage as the primary data store
- Network operations (fetch scores.json) fail gracefully when offline
- Property tests use fast-check library with minimum 100 iterations
- Migration runs once per device on first load after feature deployment
