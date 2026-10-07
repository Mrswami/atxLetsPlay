# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-10-07

### Added
- **Username Availability Check**: Added a "Check" button next to the unique username field in the `Settings` page. Uses Firebase Firestore to check for uniqueness before saving.
- **Find Friends Tab**: Added a dedicated standalone "Find Friends" tab into the Settings screen. It includes a search bar to look up users by their unique `@username`.
- **Email Notification Toggles**: Added mock UI toggles for "Game Reminders", "Court Invitations", and "Friend Invitations & Adds" in the Alerts & Privacy settings tab.
- **Missing Court Button**: Large "Missing a court? Let us know!" button at the bottom of each district court list; opens a pre-filled recommendation email.
- **Court Management Protocol**: `docs/COURT_MANAGEMENT.md` plus `scripts/validateCourts.mjs` (`npm run validate:courts`) to detect duplicate ids/names/nearby same-sport courts, unknown sports/districts and garbled characters. Runs in CI before build.

### Changed
- **Settings UI Layout**: Reordered settings tabs. "Alerts & Privacy" is now second, "Find Friends" is third.
- **Save Buttons**: Replaced the sticky `isDirty` auto-save action bar with explicit, static "Save Profile Changes" buttons at the bottom of each respective tab.
- **Map Base Layer**: Switched the `AustinStreetMap` map base layer from `esri_gray` to `CartoDB Voyager`. The new map style correctly renders parks in green and water in blue, maintaining a light aesthetic.
- **Courts Data**: Petanque now labelled "Hangar"; spelling/character-encoding fixes; removed the first-screenshot court in favour of the second.

### Removed
- **Map Controls**: Removed manual zoom controls (`+ / -`) on the main street map view for a cleaner interface.

### UX Improvements
- **Username Auto-Check**: The username field now checks availability automatically as you type.
- **Username Confirmation**: A 'Confirm & Save' button appears only when a username is confirmed available to prevent accidental typos.
- **Auto-Save Profile**: All profile fields now auto-save implicitly on blur or toggle, removing the need for manual Save buttons.
