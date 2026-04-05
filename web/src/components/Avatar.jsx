import './Avatar.css';

export default function Avatar({ url, name, size = 'large', xp = 0 }) {
  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className={`avatar avatar--${size}`}>
      <div className="avatar-glow"></div>
      {url ? (
        <img src={url} alt={name || 'Avatar'} className="avatar-img" />
      ) : (
        <div className="avatar-placeholder">
          <svg className="avatar-silhouette" viewBox="0 0 120 120" fill="currentColor">
            <circle cx="60" cy="40" r="22" />
            <ellipse cx="60" cy="100" rx="38" ry="28" />
          </svg>
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
