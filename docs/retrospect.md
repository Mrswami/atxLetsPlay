# Project Retrospective & Memory Management

## 1. Summary of Recent Changes
Over the course of this session, we accomplished several key milestones for **ATX Let's Play**:
- **CourtDetail UI Refactor:** Streamlined the court tags to be compact and removed redundant strings for a cleaner, modern look.
- **Onboarding & Auth Flow:** Integrated an mandatory onboarding wizard. New users logging in via Google or Email are flagged and routed to onboarding to claim a unique `username`, set up their profile, and define their play style.
- **Firebase CI/CD Secrets Fix:** Diagnosed production deployment failures related to missing GitHub Action Secrets for Firebase API keys. The CI/CD pipeline is now healthy.
- **Avatar Studio Presets (v2):** 
  - Generated 11 highly diverse, retro low-poly Sims-style 3D avatar portraits.
  - Migrated the assets through an OpenArt CLI pipeline (`generate_v2.ps1`) to strip environment backgrounds, resulting in clean, video-game selection screen portraits.
  - Re-mapped `Settings.jsx` to natively consume the new `public/assets/characters_v1/` directory using human-readable naming conventions (`preset_age_randomName.jpg`).
  - By placing these in `public/assets`, they are now automatically bundled and efficiently distributed over Firebase Hosting's edge CDN, which outperforms basic Firebase Storage buckets for static UI assets.
- **Settings & Social (batch 2):** Username auto-check with confirm-and-save, auto-saving profile, Alerts tab moved to second, standalone Find Friends tab, notification toggles (game reminders, court/friend invites).
- **Map:** Removed manual zoom, switched to CartoDB Voyager (green parks, blue water), dropped satellite toggle.
- **Games:** Date/time defaults to today with a calendar limited to 3 months, past times blocked (starting in 1 minute is fine), success toast "Game made/joined (1/5)" with a 5-games/day cap.
- **Courts:** "Petanque" renamed "Hangar", text/encoding fixes, one court removed, **Missing a court?** button, `scripts/validateCourts.mjs` + `docs/COURT_MANAGEMENT.md` protocol, validation step added to CI.
- **Lesson learned:** ad-hoc `patch*.cjs` regex scripts failed silently (reported "Patched" with no change). Prefer direct edits and verify with a build/grep afterward.

## 2. Memory Management: Best Practices
As the codebase and project complexity grow, here is how we should structure and manage memory moving forward:

### A. The Knowledge Item (KI) System
The KI System is my primary long-term memory. It allows me to read curated, localized context about the repository before executing tasks. 
- **What to store:** Established patterns, recurring gotchas, architectural decisions, and custom workflow scripts (like the Firebase Bypass rules).
- **How to manage it:** If we establish a new pattern (e.g., "How we handle image processing pipelines with OpenArt"), you can ask me to summarize it into a Knowledge Item. I will read these KI summaries automatically at the start of future conversations to regain context.

### B. Custom Rules & Skills
For strict guardrails and behavioral guidelines (e.g., the FinTech Payments Constitution or Firebase environment constraints), we use **Rules**. 
- Rules are automatically injected into my prompt instructions.
- We can create new Markdown files under `C:\Users\freem\.gemini\config\rules\` for project-wide constraints, ensuring I *never* forget critical deployment steps or UI aesthetic requirements (like the "Use Rich Aesthetics" web development directive).

### C. Artifacts
Artifacts (like this document) are short-to-medium-term memory. They belong in the conversation's workspace folder.
- **What to store:** Analysis reports, mapping manifestos, data schemas, or scratch scripts.
- **When to use:** Use artifacts to document complex, multi-step plans before we write code. If a plan is successful, its key takeaways can be migrated to a permanent Knowledge Item.

### D. Codebase as the Truth
Ultimately, the most robust memory is well-structured code. By organizing our data (e.g., `courtsMeta.js`), standardizing asset paths (`characters_v1`), and keeping pure components, the codebase self-documents its state, minimizing the context you have to explain to me.

- **Trust & safety (batch 3):** email-verification gate (client + Firestore rules), report/block, no-show attendance + reliability %, notification channel/event preferences, FCM groundwork + scheduled reminder function. Also fixed Alerts toggles whose state setters were missing (an earlier regex patch had silently stripped them).
