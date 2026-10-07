# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-10-07

### Added
- **Live Game Chat & Score**: Added a new `/live-game/:gameId` route. Live games in the ATX feed now route to a real-time chat page with floating YouTube-style heart reactions, timestamped messages, and a host-controlled Home/Away score tracker.
- **Ended Game States**: Games that finished over 2 hours ago are now faded in the live feed. Clicking an ended game provides read-only access to final scores, participants, and chat logs.
- **City Permit Warnings**: Implemented warning banners in the Court Detail and Game Scheduling screens detailing official Austin Parks & Rec (PARD) permit requirements for exclusive usage, including contact info (email and 3-1-1 phone line).
- **Guest Game Hosting**: Removed the hard stop for unverified users to allow "Guests" to host games. Created a 1-minute buffer for game creation time validation. Guest hosts now accurately display as "A Guest Player" in the live feed.
- **Username Availability Check**: Added a "Check" button next to the unique username field in the `Settings` page. Uses Firebase Firestore to check for uniqueness before saving.
- **Find Friends Tab**: Added a dedicated standalone "Find Friends" tab into the Settings screen. It includes a search bar to look up users by their unique `@username`.
- **Email Notification Toggles**: Added mock UI toggles for "Game Reminders", "Court Invitations", and "Friend Invitations & Adds" in the Alerts & Privacy settings tab.
- **Missing Court Button**: Large "Missing a court? Let us know!" button at the bottom of each district court list; opens a pre-filled recommendation email.
- **Court Management Protocol**: `docs/COURT_MANAGEMENT.md` plus `scripts/validateCourts.mjs` (`npm run validate:courts`) to detect duplicate ids/names/nearby same-sport courts, unknown sports/districts and garbled characters. Runs in CI before build.
- **Email Verification Gate**: Joining or hosting a game now requires a verified email (Google and magic-link sign-ins are verified automatically). Verification email is sent on signup; in-app banner offers Resend and "I verified". Enforced in the client (`joinGame`, `CreateGame`) and in Firestore rules.
- **Report & Block**: Report a player (reason + details) or block them from their profile. Blocked hosts' games are hidden from feeds. New `reports` collection (write-only for users) and private `users/{uid}/blocks`.
- **Reliability & No-shows**: Hosts can take attendance on started games; profile shows a Reliability %. 3 no-shows in 30 days pauses joining until they age out.
- **Notification Delivery Preferences**: Alerts tab now has push / email / SMS channels (with mobile number) and per-event toggles for game reminders, court invitations, friend invitations and friend adds. All changes save instantly.
- **Push Notifications Groundwork**: FCM service worker, device token registration, and a scheduled `sendGameReminders` Cloud Function (push + Trigger Email + SMS extension collections). Needs `VITE_FIREBASE_VAPID_KEY` and a function deploy (Blaze plan) to go live.

### Changed
- **Settings UI Layout**: Reordered settings tabs. "Alerts & Privacy" is now second, "Find Friends" is third.
- **Save Buttons**: Replaced the sticky `isDirty` auto-save action bar with explicit, static "Save Profile Changes" buttons at the bottom of each respective tab.
- **Map Base Layer**: Switched the `AustinStreetMap` map base layer from `esri_gray` to `CartoDB Voyager`. The new map style correctly renders parks in green and water in blue, maintaining a light aesthetic.
- **Courts Data**: Petanque now labelled "Hangar"; spelling/character-encoding fixes; removed the first-screenshot court in favour of the second.
- **ATX Live Feed Data**: The Live Feed now dynamically displays the actual username (`hostName`) or "A Guest Player" instead of static mock data.
- **Avatar Styling**: Removed the pulsing `.avatar-ring-glow` border from avatars globally, and increased the avatar dimensions (`large` is 180px, `medium` is 110px) to make them more visible.

### Fixed
- **Alerts & Privacy toggles**: the four existing toggles (pickup alerts, game invites, on-court status, public profile) never changed state because their setters were missing; they now update and save instantly.

### Removed
- **Map Controls**: Removed manual zoom controls (`+ / -`) on the main street map view for a cleaner interface.

### UX Improvements
- **Username Auto-Check**: The username field now checks availability automatically as you type.
- **Username Confirmation**: A 'Confirm & Save' button appears only when a username is confirmed available to prevent accidental typos.
- **Auto-Save Profile**: All profile fields now auto-save implicitly on blur or toggle, removing the need for manual Save buttons.
