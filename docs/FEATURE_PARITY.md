# ATX Let's Play - Flutter Migration Feature Parity Log

This document serves as the comprehensive feature parity checklist for the upcoming migration to Flutter (Web, Android, iOS). All features listed below are currently implemented in the web version and must be replicated in the Flutter application.

## 1. Map & Overworld Interface
- [ ] **Street/Terrain Map View**: Interactive map utilizing CartoDB Voyager base layer (correctly rendering parks green and water blue).
- [ ] **Dashboard View**: Dynamic toggle between the map view and dashboard view, pinned to the bottom.
- [ ] **Floating Navigation**: Persistent floating Overworld Avatar and Login buttons.
- [ ] **Custom Court Assets**: High-fidelity, stylized 3D environment banners for Austin parks (e.g., Mueller Hangar, Pease Park, Zilker, Don Baylor).
- [ ] **Map Markers (Roadmap)**: Pulsing Avatar markers with glowing, sport-colored rings over active game locations.

## 2. Venmo-Style Social Activity Feed
- [ ] **Real-Time Live Feed**: Scrolling activity feed displaying global active pickup games.
- [ ] **Data Points**: Feed items show host avatar, sport emoji, court name, scheduled time, and RSVP count.
- [ ] **Dynamic Display Name**: Feed correctly shows actual `@username` (hostName) or "A Guest Player".
- [ ] **Game State Visualization**: Games ended over 2 hours ago are faded out, but accessible in read-only mode (scores, chat, participants).
- [ ] **Deep Linking**: 1-click navigation from feed item to Court Detail or Live Game Room.

## 3. Game Management & Lifecycle
- [ ] **Game Creation**: Ability to set game duration (1-4 hours).
- [ ] **Quota System**: Anti-spam limits (max 2 simultaneous live games, max 5 scheduled per day).
- [ ] **Auto-Expiration**: Client and background logic to fade/close games 2 hours after start.
- [ ] **Permit Warnings**: Warning banners regarding Austin Parks & Rec (PARD) permit requirements.
- [ ] **Host Controls**: Hosts can take attendance.
- [ ] **Guest Hosting**: Guests can host games ("A Guest Player") with a 1-minute buffer validation.

## 4. Live Game Room & Chat
- [ ] **Real-Time Live Chat**: Timestamped messages, floating YouTube-style heart reactions.
- [ ] **Score Tracker**: Host-controlled Home/Away score tracker.
- [ ] **Dynamic Usernames**: Chat messages display actual `@username`, updating dynamically if changed in settings.
- [ ] **Profile Linking**: Clicking an avatar or username in chat opens their profile.
- [ ] **Visual Polish**: High-res court banner image headers replacing placeholder graphics.
- [ ] **Chat Autocomplete**: Typing `@` shows an inline dropdown of player handles for tagging.
- [ ] **Quick Join**: "Join Live Match Room" quick-action button on active games.

## 5. Social & Friends Hub
- [ ] **Friends Hub Tabs**: Squad List, Add Friend Search (via `@username`), and Pending Inbox.
- [ ] **Friend Requests**: Reassuring "Friend Request Sent!" glassmorphic modals with undo capabilities.
- [ ] **Spam Protection**: Deterministic locking of pending request buttons to prevent duplicate spam.
- [ ] **Safety Dialogs**: Confirmation modals for canceling pending requests and removing friends.
- [ ] **Profile Stats**: Display total friend count, clickable to view the squad list.

## 6. Mentions & Notification Ecosystem
- [ ] **@Mention Court Invites**: Typing `@username` in chat sends a court invite notification via Firestore.
- [ ] **Global Invite Banner**: Real-time slide-down banner when tagged, with 1-click "Accept & Join Match".
- [ ] **Invites Inbox**: Court invites appear alongside friend requests with real-time badge counts.
- [ ] **Email/Push Toggles**: Notification preferences for game reminders, invites, and friend adds.
- [ ] **Push Infrastructure**: FCM service worker setup, scheduled Cloud Functions for reminders.

## 7. Court Communities & Details
- [ ] **Court Discussions**: Real-time discussion/review section on every court detail page.
- [ ] **Authentication Prompts**: Guests prompted to sign in when trying to comment or chat.
- [ ] **Canonical Ordering**: Enforced display ordering (e.g., Mueller Hangar Browning Court).
- [ ] **Suggest a Court Form**: In-app form for community court requests sending emails.
- [ ] **Data Integrity**: Automated CI validation (`validateCourts.mjs`) to detect duplicates, bad data, and ensure metadata matches.

## 8. Authentication & Profile Settings
- [ ] **Auth Flows**: Google Sign-In, Email/Password, and Guest access.
- [ ] **Email Verification Gate**: Requires verified email to join/host games (automatically verified for Google/Magic-link).
- [ ] **Guest-to-Account Merge**: Linking a Google/Email account saves Guest XP/stats permanently.
- [ ] **Unique Usernames**: Auto-generated default usernames (`@handle_xxxx`).
- [ ] **Username Checks**: Real-time availability checker in settings before saving.
- [ ] **Username Cooldown**: Strict 14-day limit on changing usernames.
- [ ] **Auto-Save Profile**: All profile/settings fields auto-save on blur/toggle.
- [ ] **Safety/Moderation**: Report/Block players (blocks hide games from feeds), reliability scores based on no-shows.

## 9. Visuals & UX
- [ ] **Avatars**: Increased visibility (110px medium, 180px large), no pulsing ring glows.
- [ ] **Toasts/Alerts**: Glassmorphic modals and instant toast notifications replacing standard alerts.
- [ ] **Map Controls**: Clean interface with manual zoom controls hidden.
