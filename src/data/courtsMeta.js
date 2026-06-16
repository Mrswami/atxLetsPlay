// ATX Let's Play — Court data (client-safe, no seed script dependencies)
// This is the static reference used by the app UI before Firestore data loads.

export const SPORT_META = {
  basketball: { label: 'Basketball', emoji: '🏀', color: '#f97316' },
  soccer: { label: 'Soccer', emoji: '⚽', color: '#22d366' },
  tennis: { label: 'Tennis', emoji: '🎾', color: '#eab308' },
  pickleball: { label: 'Pickleball', emoji: '🏓', color: '#06b6d4' },
  volleyball: { label: 'Volleyball', emoji: '🏐', color: '#8b5cf6' },
  baseball: { label: 'Baseball', emoji: '⚾', color: '#ef4444' },
  softball: { label: 'Softball', emoji: '🥎', color: '#f43f5e' },
  'disc-golf': { label: 'Disc Golf', emoji: '🥏', color: '#10b981' },
  petanque: { label: 'Pétanque', emoji: '🥌', color: '#a78bfa' },
};

export const DISTRICT_META = {
  north: { label: 'North Austin', color: 'var(--district-north)' },
  'hyde-park': { label: 'Hyde Park', color: 'var(--district-hydepark)' },
  mueller: { label: 'Mueller', color: 'var(--district-mueller)' },
  east: { label: 'East Austin', color: 'var(--district-east)' },
  downtown: { label: 'Downtown', color: 'var(--district-downtown)' },
  norwood: { label: 'Zilker / Norwood', color: 'var(--district-norwood)' },
  'south-congress': { label: 'South Congress', color: 'var(--district-scongress)' },
  south: { label: 'South Austin', color: 'var(--district-south)' },
  river: { label: 'Barton Creek', color: 'var(--district-river)' },
};
