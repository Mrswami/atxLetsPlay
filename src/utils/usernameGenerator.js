// Basic Username Generator for ATX Let's Play
// Generates clean, unique default usernames for all users on account creation or fallback

export function generateDefaultUsername(displayName, uid) {
  const cleanName = (displayName || 'baller')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const base = cleanName.length >= 3 ? cleanName : 'atxballer';
  const suffix = uid ? uid.slice(-4).toLowerCase() : Math.floor(1000 + Math.random() * 9000).toString();
  return `${base.slice(0, 14)}_${suffix}`;
}
