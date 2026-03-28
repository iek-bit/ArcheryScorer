# Requirements Document

## Introduction

This document specifies requirements for adding shared scoring functionality to the archery scoring application using a simple shared JSON file approach. The feature enables archers to view each other's rounds through a shared `scores.json` file hosted alongside the application on GitHub Pages. Archers can toggle between viewing their own personal rounds and viewing all other archers' rounds in the History tab, with all existing filter and sort functionality working in both views.

## Glossary

- **Archery_App**: The single-file HTML archery scoring application
- **Shared_JSON_File**: The `scores.json` file hosted in the same directory as index.html on GitHub Pages
- **Session**: A scoring session containing rounds, which can be a tournament (bullseye or 3D), practice, or quick score
- **Round**: A collection of arrow scores within a session
- **Archer**: A user of the application identified by their archer name
- **Archer_Name**: The display name that identifies an archer in the shared scoring system
- **Local_Storage**: The browser's localStorage where session data is currently stored
- **Personal_View**: The History tab view showing only the current archer's rounds
- **Public_View**: The History tab view showing all other archers' rounds (excluding the current archer)
- **History_Tab**: The existing tab in the application that displays past scoring sessions

## Requirements

### Requirement 1: Archer Identity Management

**User Story:** As an archer, I want to set my name, so that other archers can identify my rounds in the shared view.

#### Acceptance Criteria

1. THE Archery_App SHALL provide a UI to set the Archer_Name
2. THE Archery_App SHALL store the Archer_Name in Local_Storage
3. WHEN a session is created, THE Archery_App SHALL tag it with the current Archer_Name
4. THE Archery_App SHALL allow changing the Archer_Name at any time
5. WHEN the Archer_Name is changed, THE Archery_App SHALL apply the new name to all future sessions

### Requirement 2: Shared JSON File Structure

**User Story:** As a developer, I want a simple JSON structure for shared scores, so that the system is easy to maintain and debug.

#### Acceptance Criteria

1. THE Shared_JSON_File SHALL be located at `./scores.json` in the same directory as index.html
2. THE Shared_JSON_File SHALL contain an array of session objects
3. THE Archery_App SHALL include the Archer_Name field in each session object
4. THE Archery_App SHALL include a unique session ID in each session object
5. THE Archery_App SHALL include a timestamp in each session object

### Requirement 3: History Tab Toggle

**User Story:** As an archer, I want to toggle between viewing my own rounds and viewing other archers' rounds, so that I can compare my performance with others.

#### Acceptance Criteria

1. THE History_Tab SHALL display a toggle control with "Personal" and "Public" options
2. WHEN "Personal" is selected, THE History_Tab SHALL display only sessions where the Archer_Name matches the current archer
3. WHEN "Public" is selected, THE History_Tab SHALL display only sessions where the Archer_Name does NOT match the current archer
4. THE Archery_App SHALL remember the last selected toggle state in Local_Storage
5. THE Archery_App SHALL default to "Personal" view on first use

### Requirement 4: Filter and Sort Compatibility

**User Story:** As an archer, I want all existing filter and sort functions to work in both Personal and Public views, so that I can find specific rounds easily.

#### Acceptance Criteria

1. WHEN viewing Personal or Public rounds, THE Archery_App SHALL apply date filters to the displayed sessions
2. WHEN viewing Personal or Public rounds, THE Archery_App SHALL apply location filters to the displayed sessions
3. WHEN viewing Personal or Public rounds, THE Archery_App SHALL apply sort options to the displayed sessions
4. WHEN viewing Personal or Public rounds, THE Archery_App SHALL apply search queries to the displayed sessions
5. THE Archery_App SHALL preserve filter and sort settings when switching between Personal and Public views

### Requirement 5: Round Detail View

**User Story:** As an archer, I want to view detailed information about any round in the Public view, so that I can see exactly how other archers performed.

#### Acceptance Criteria

1. WHEN an archer taps a round in the Public view, THE Archery_App SHALL display the round detail overlay
2. THE round detail overlay SHALL display the Archer_Name
3. THE round detail overlay SHALL display all arrow scores for each end
4. THE round detail overlay SHALL display the total score
5. THE round detail overlay SHALL display the session type and metadata

### Requirement 6: Score Synchronization on Round Completion

**User Story:** As an archer, I want my completed rounds to sync to the shared file automatically, so that other archers can see my scores without manual action.

#### Acceptance Criteria

1. WHEN a round is completed, THE Archery_App SHALL fetch the current Shared_JSON_File
2. WHEN the Shared_JSON_File is fetched, THE Archery_App SHALL append or update the completed session
3. WHEN updating the Shared_JSON_File, THE Archery_App SHALL preserve all existing sessions from other archers
4. THE Archery_App SHALL use HTTP PUT or POST to write the updated Shared_JSON_File
5. IF the write operation fails, THEN THE Archery_App SHALL preserve the session in Local_Storage and continue functioning

### Requirement 7: Score Synchronization on App Load

**User Story:** As an archer, I want to see the latest scores from other archers when I open the app, so that I have current information.

#### Acceptance Criteria

1. WHEN the Archery_App loads, THE Archery_App SHALL fetch the Shared_JSON_File
2. WHEN the Shared_JSON_File is fetched, THE Archery_App SHALL merge sessions into Local_Storage
3. THE Archery_App SHALL preserve existing local sessions that are not in the Shared_JSON_File
4. THE Archery_App SHALL use session IDs to avoid duplicate entries
5. IF the fetch operation fails, THEN THE Archery_App SHALL continue functioning with local data only

### Requirement 8: Backward Compatibility and Migration

**User Story:** As an existing user, I want my historical rounds to sync to the shared file, so that other archers can see my past performance.

#### Acceptance Criteria

1. WHEN the Archery_App loads for the first time after feature deployment, THE Archery_App SHALL detect existing sessions without Archer_Name
2. WHEN existing sessions are detected, THE Archery_App SHALL add the current Archer_Name to those sessions
3. WHEN existing sessions are updated with Archer_Name, THE Archery_App SHALL sync all sessions to the Shared_JSON_File
4. THE Archery_App SHALL perform this migration only once per device
5. THE Archery_App SHALL preserve all session data during migration

### Requirement 9: Offline Support

**User Story:** As an archer, I want the app to work offline, so that I can record scores in remote locations without internet connectivity.

#### Acceptance Criteria

1. WHEN the device is offline, THE Archery_App SHALL continue to save sessions to Local_Storage
2. WHEN the Shared_JSON_File fetch fails, THE Archery_App SHALL continue functioning with local data
3. WHEN the Shared_JSON_File write fails, THE Archery_App SHALL preserve the session locally
4. THE Archery_App SHALL NOT display error messages for failed sync operations
5. THE Archery_App SHALL attempt to sync on the next app load or round completion

### Requirement 10: Protected Editing with Full Viewing Features

**User Story:** As an archer, I want to view and analyze other archers' rounds with all available tools (printing, viewing details), but I should not be able to edit or delete their data, so that the shared data remains accurate.

#### Acceptance Criteria

1. THE Archery_App SHALL NOT allow editing sessions where the Archer_Name does not match the current archer
2. THE Archery_App SHALL NOT allow deleting sessions where the Archer_Name does not match the current archer
3. WHEN viewing a round detail in Public_View, THE Archery_App SHALL NOT display delete or edit buttons
4. THE Archery_App SHALL allow printing scorecards for any session in both Personal_View and Public_View
5. THE Archery_App SHALL allow viewing detailed round information for any session in both Personal_View and Public_View
6. THE Archery_App SHALL allow using all filter, sort, and search functions on sessions in both Personal_View and Public_View
7. THE Archery_App SHALL allow editing and deleting only in Personal_View for the current archer's sessions
