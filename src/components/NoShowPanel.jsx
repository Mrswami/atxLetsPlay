import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { setNoShow } from '../services/safety';

// Host-only: after a game starts, mark players who didn't show up. Stored on the game doc.
export default function NoShowPanel({ game, hostId }) {
  const [names, setNames] = useState({});
  const [noShows, setNoShows] = useState(game.noShows || []);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');

  const players = (game.currentPlayers || []).filter((id) => id !== hostId);

  useEffect(() => {
    if (!open) return;
    players.forEach(async (id) => {
      if (names[id]) return;
      try {
        const s = await getDoc(doc(db, 'users', id));
        setNames((n) => ({ ...n, [id]: s.exists() ? s.data().displayName || 'Player' : 'Player' }));
      } catch { setNames((n) => ({ ...n, [id]: 'Player' })); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (players.length === 0) return null;

  async function toggle(id) {
    setErr('');
    try {
      setNoShows(await setNoShow(game.id, noShows, id, !noShows.includes(id)));
    } catch (e) { setErr(e.message || 'Could not update.'); }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" className="game-join-btn leave" onClick={() => setOpen((v) => !v)} id={`noshow-toggle-${game.id}`}>
        {open ? 'Hide attendance' : 'Take attendance'}
      </button>
      {open && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
          {players.map((id) => (
            <li key={id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>{names[id] || '...'}</span>
              <label>
                <input type="checkbox" checked={noShows.includes(id)} onChange={() => toggle(id)} /> No-show
              </label>
            </li>
          ))}
        </ul>
      )}
      {err && <div style={{ color: '#f87171' }}>{err}</div>}
    </div>
  );
}
