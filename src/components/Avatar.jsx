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
          <span className="avatar-initials">{initials}</span>
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
