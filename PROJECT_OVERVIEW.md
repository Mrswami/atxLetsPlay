# ATX Let's Play - Project Overview & Changelog

## 🚀 Vision
**ATX Let's Play** is a premium, community-driven pickup sports finder for Austin, Texas. It blends high-fidelity 3D aesthetics with a "Venmo-style" social feed to help locals find, host, and join pickup games (Basketball, Tennis, Pickleball, Volleyball, etc.) across various Austin districts.

---

## 🛠️ Major Accomplishments & Features Built

### 1. High-Fidelity Court Asset Pipeline
*   **Custom 3D Art:** Established a Gemini + OpenArt generative pipeline to create breathtaking, stylized 3D environment banners for Austin parks (e.g., *Mueller Hangar*, *Pease Park*, *Zilker*, *Don Baylor*).
*   **Aesthetic Priority:** Moved away from generic placeholder boxes to ensure every court feels like a premium, handcrafted "level" on the map.

### 2. Overworld & Dashboard UI
*   **View Modes:** Built a dynamic toggle between the geographic "Street/Terrain Map" and the "Dashboard" view.
*   **UI Polish:** Pinned the view toggle to the bottom of the screen to prevent overlap with the native map search bar, ensuring a clean, uncluttered layout.
*   **Persistent Navigation:** Added floating overworld Avatar and Login buttons for quick access to profiles and authentication at all times.

### 3. Venmo-Style Social Activity Feed
*   **Live Feed:** Implemented a real-time, scrolling Activity Feed on the dashboard that surfaces all active pickup games globally across Austin.
*   **Data Rich:** Feed items display the host's avatar, sport emoji, court name, scheduled time, and current RSVP count.
*   **Deep Linking:** 1-click routing from a feed item directly to the respective Court Detail page.

### 4. Game Quotas & Lifecycle Limits
*   **Anti-Spam Quota:** Implemented robust hosting caps to protect community health and prevent spam, restricting users to a maximum of 2 simultaneous live games and no more than 5 scheduled games per day (regardless of overlap).
*   **Future Lifecycle Roadmap:** Planned auto-expiration logic (games expire 2 hours post-start) to dynamically manage quotas and clear out "zombie" games.

### 5. Profile & Settings Engineering
*   **Auto-Save Interceptor:** Built an intelligent back-button interceptor in `Settings.jsx` that detects unsaved modifications (like Sport Preferences) and automatically syncs them to Firebase before navigating away.
*   **Guest-to-Account Merging:** Engineered the authentication flow to allow users to rack up XP as a Guest and permanently save their stats by linking a Google/Email account.

### 6. Community Integration
*   **"Suggest a Court" Pipeline:** Built an in-app form for the community to request missing courts or submit raw reference photos directly to the dev team email (`jacobflutterdev@gmail.com`), allowing us to maintain our high-quality asset standard without relying on mass API imports.

---

## 🔮 Roadmap (Upcoming Features)
1.  **Map Visual Polish:** Implement pulsing Avatar markers with glowing, sport-colored rings over active game locations on the Overworld map.
2.  **1-Click RSVPs:** Add an "I Got Next" button directly onto the Venmo-style feed items.
3.  **Authentication Fixes:** Resolve cross-site tracking/cookie issues causing Google Sign-In failures on mobile Firefox browsers.
4.  **Auto-Expiration Logic:** Complete the background/client filtering to auto-close games 2 hours after start time.
