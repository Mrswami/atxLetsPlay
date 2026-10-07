import { useState, useEffect } from 'react';
import './InAppBrowserWarning.css';

export default function InAppBrowserWarning() {
  const [isInApp, setIsInApp] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    // Common in-app browsers
    const rules = [
      'FBAV', 'FBAN', // Facebook
      'Instagram',    // Instagram
      'Twitter',      // Twitter
      'Snapchat',     // Snapchat
      'Line',         // Line
      'TikTok',       // TikTok
      'LinkedInApp'   // LinkedIn
    ];
    
    if (rules.some(rule => ua.indexOf(rule) > -1)) {
      setIsInApp(true);
    }
  }, []);

  if (!isInApp) return null;

  return (
    <div className="iab-warning-overlay">
      <div className="iab-warning-card">
        <div className="iab-icon">⚠️</div>
        <h3>Open in System Browser</h3>
        <p>
          You are viewing ATX Let's Play inside an app (like Instagram or Twitter). 
          <strong> Google Sign-In and Map features will not work correctly here.</strong>
        </p>
        <div className="iab-instructions">
          <p>1. Tap the three dots <strong>(•••)</strong> in the top corner of your screen.</p>
          <p>2. Select <strong>"Open in system browser"</strong> or <strong>"Open in Chrome/Safari"</strong>.</p>
        </div>
        <button className="iab-close-btn" onClick={() => setIsInApp(false)}>
          I understand, continue anyway
        </button>
      </div>
    </div>
  );
}
