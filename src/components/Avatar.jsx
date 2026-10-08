import './Avatar.css';

const FALLBACK_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308'];
const FALLBACK_SYMBOLS = ['👑', '🏆', '⏱️', '🎳', '👤', '⚡', '🔥', '🏅', '🌟', '🎯', '🚀', '💎'];

function getHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export default function Avatar({ url, name, size = 'large', xp = 0 }) {
  const safeName = name || '?';
  const hash = getHash(safeName);
  const color = FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
  const symbol = FALLBACK_SYMBOLS[hash % FALLBACK_SYMBOLS.length];

  return (
    <div className={`avatar avatar--${size}`}>
      {!url && (
        <div className="avatar-dynamic-glow" style={{ '--glow-color': color }}></div>
      )}
      {url ? (
        <img src={url} alt={safeName} className="avatar-img" />
      ) : (
        <div className="avatar-dynamic-placeholder" style={{ borderColor: color, boxShadow: `inset 0 0 15px ${color}40` }}>
          <span className="avatar-symbol">{symbol}</span>
        </div>
      )}
      {xp > 0 && (
        <div className="avatar-xp-badge">
          <span className="xp-icon">⚡</span>
          <span className="xp-value">{xp.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
