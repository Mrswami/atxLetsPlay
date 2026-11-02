import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import './GameSlotsRow.css';

// Shared in-memory cache so feed cards don't re-fetch the same user profile repeatedly
const profileCache = new Map();

async function getCachedProfile(uid) {
  if (!uid) return null;
  if (uid.startsWith('guest-')) {
    return { uid, displayName: 'Guest Player', avatarUrl: '' };
  }
  if (profileCache.has(uid)) {
    return profileCache.get(uid);
  }
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = { uid, ...snap.data() };
      profileCache.set(uid, data);
      return data;
    }
  } catch (_) {
    // Ignore offline/permission errors and use fallback
  }
  const fallback = { uid, displayName: 'Player', avatarUrl: '' };
  profileCache.set(uid, fallback);
  return fallback;
}

export default function GameSlotsRow({ game, compact = false }) {
  const currentPlayers = game?.currentPlayers?.length
    ? game.currentPlayers
    : game?.createdBy
    ? [game.createdBy]
    : [];
  const filledCount = currentPlayers.length;
  const maxPlayers = Math.max(parseInt(game?.maxPlayers || 10, 10), filledCount, 2);
  const maxVisibleSlots = compact ? Math.min(maxPlayers, 6) : Math.min(maxPlayers, 8);
  const extraSlots = Math.max(0, maxPlayers - maxVisibleSlots);

  const [playerProfiles, setPlayerProfiles] = useState({});

  useEffect(() => {
    let active = true;
    const uidsToLoad = currentPlayers.slice(0, maxVisibleSlots);
    Promise.all(uidsToLoad.map((uid) => getCachedProfile(uid))).then((results) => {
      if (!active) return;
      const map = {};
      results.forEach((p) => {
        if (p?.uid) map[p.uid] = p;
      });
      setPlayerProfiles(map);
    });
    return () => {
      active = false;
    };
  }, [currentPlayers.join(','), maxVisibleSlots]);

  const slots = [];
  for (let i = 0; i < maxVisibleSlots; i++) {
    const uid = currentPlayers[i];
    const isFilled = Boolean(uid);
    const prof = uid ? playerProfiles[uid] : null;
    const avatarUrl =
      prof?.avatarUrl ||
      (i === 0 && game?.hostAvatarUrl ? game.hostAvatarUrl : '');
    const displayName =
      prof?.displayName ||
      (i === 0 ? game?.creatorName || game?.hostName || 'Host' : 'Player');
    const initials =
      displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'P';

    slots.push({
      index: i,
      isFilled,
      uid,
      avatarUrl,
      displayName,
      initials,
    });
  }

  // Build concise dot string e.g. 🟢🟢🟢⚪ (up to 6 dots for quick visual scan)
  const dotCap = Math.min(maxPlayers, 6);
  const filledDots = Math.min(filledCount, dotCap);
  const emptyDots = Math.max(0, dotCap - filledDots);
  const dotSummary = '🟢'.repeat(filledDots) + '⚪'.repeat(emptyDots);

  return (
    <div className={`game-slots-row ${compact ? 'game-slots-row--compact' : ''}`}>
      <div className="gsr-avatars" aria-label={`${filledCount} of ${maxPlayers} spots filled`}>
        {slots.map((slot) =>
          slot.isFilled ? (
            <div
              key={`slot-${slot.index}`}
              className="gsr-slot gsr-slot--filled"
              title={`${slot.displayName} (Joined)`}
            >
              {slot.avatarUrl ? (
                <img src={slot.avatarUrl} alt={slot.displayName} className="gsr-avatar-img" />
              ) : (
                <span className="gsr-avatar-initials">{slot.initials}</span>
              )}
              <span className="gsr-dot-indicator gsr-dot-indicator--filled" />
            </div>
          ) : (
            <div
              key={`slot-${slot.index}`}
              className="gsr-slot gsr-slot--open"
              title="Open slot"
            >
              <span className="gsr-open-plus">+</span>
            </div>
          )
        )}
        {extraSlots > 0 && (
          <span className="gsr-extra-slots" title={`${extraSlots} more slots`}>
            +{extraSlots}
          </span>
        )}
      </div>

      <div className="gsr-summary">
        <span className="gsr-dots-text" aria-hidden="true">
          {dotSummary}
        </span>
        <span className="gsr-fraction">
          ({filledCount}/{maxPlayers})
        </span>
      </div>
    </div>
  );
}
