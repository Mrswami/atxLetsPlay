# Cross-Device & Browser Regression Testing Matrix

To ensure our authentication and UI hold up perfectly across every possible environment (especially considering tricky cross-site tracking policies and WebViews), we will use this testing matrix.

## 📱 Mobile & Tablet (Native Browsers)
These browsers have native support for tabs and popups, but vary heavily in their privacy settings.

| Device Category | Device Example | Browser | Risk Area | Expected Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Modern iOS** | iPhone 15 Pro | Safari | ITP (Intelligent Tracking Prevention) blocks 3rd-party auth cookies. | Google Auth must complete via redirect or secure popup without looping. |
| **Modern iOS** | iPhone 14 | Chrome | Relies on WKWebView. | Popups should open correctly; Auth should persist. |
| **Modern Android** | Samsung Galaxy S24 | Chrome | Standard V8 engine. | Native popup flow should be seamless. |
| **Modern Android** | Google Pixel 8 | **Firefox Mobile** | **Strict ETP (Enhanced Tracking Protection)** | Known to block popups or cross-site tracking. Need fallback to Redirect or Magic Link. |
| **Tablet OS** | iPad Pro | Safari (Desktop mode) | Treats UI as desktop, but touch-based. | Layout shouldn't overlap; Auth shouldn't assume mobile WebKit. |

## 🌐 In-App Browsers (WebView / SFSafariViewController)
When users click a link to ATX Let's Play from a social media post, they are trapped in a WebView. **Popups and standard OAuth redirects frequently fail here.**

| Platform | Rendering Engine | Auth Limitation | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Instagram / Threads** | Custom WebKit | Blocks `window.open` (No popups) | Display "Open in System Browser" warning modal. |
| **Facebook / Messenger** | Custom WebKit (FBAV) | Blocks popups, restricted cookie jar | Display "Open in System Browser" warning modal. |
| **Twitter / X** | Custom WebKit | Kills OAuth redirect chains | Display "Open in System Browser" warning modal. |
| **TikTok** | Custom WebKit | Extremely restricted | Display "Open in System Browser" warning modal. |

## 💻 Desktop
| Device Category | Browser | Risk Area |
| :--- | :--- | :--- |
| **Mac** | Safari | ITP blocking Auth state persistence. |
| **Mac / PC** | Chrome | Baseline standard. Should be 100% flawless. |
| **Mac / PC** | Brave / Firefox | Strict tracking protection blocks Firebase Auth domains if not careful. |

---

## Action Plan to Tackle the Bugs:
1.  **In-App Browser Detector:** We will build a utility that checks `navigator.userAgent` for signatures of Instagram, Twitter, FB, etc. If detected, we render a massive overlay telling the user: *"You are viewing this in an app. Please tap the three dots [⋯] and select 'Open in System Browser' to sign in."*
2.  **Auth Fallback:** Ensure `signInWithPopup` failures are gracefully caught, specifically pointing out when third-party cookies or popups are blocked by Firefox ETP.
