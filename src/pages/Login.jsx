import { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [magicLink, setMagicLink] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup, loginWithGoogle, sendMagicLink, continueAsGuest } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const redirectTo = searchParams.get('redirectTo') || location.state?.redirectTo || '/';

  async function handleGuest() {
    await continueAsGuest();
    navigate(redirectTo);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      if (magicLink) {
        await sendMagicLink(email);
        setMessage('Check your email for the magic link!');
      } else if (isSignup) {
        await signup(email, password, displayName);
        navigate(redirectTo);
      } else {
        await login(email, password);
        navigate(redirectTo);
      }
    } catch (err) {
      setError(err.message?.replace('Firebase: ', '') || 'Something went wrong');
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate(redirectTo);
    } catch (err) {
      setError(err.message?.replace('Firebase: ', '') || 'Google sign-in failed');
    }
    setLoading(false);
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Branding */}
        <div className="login-brand">
          <h1 className="login-title">
            <span className="brand-atx">ATX</span>
            <span className="brand-lets">LET'S</span>
            <span className="brand-play">PLAY</span>
          </h1>
          <p className="login-subtitle">
            {isSignup ? 'Join the Austin community' : magicLink ? 'The natural way to sign in' : 'Welcome back, player'}
          </p>
        </div>

        {/* Error / Success Messages */}
        {error && <div className="login-error">{error}</div>}
        {message && <div className="login-message">{message}</div>}

        {/* ⚡ Continue as Guest / Back to Globe */}
        <button
          type="button"
          className="guest-btn"
          onClick={handleGuest}
          id="guest-continue-btn"
        >
          <div className="guest-btn-content">
            <span className="guest-btn-icon">🌍</span>
            <div className="guest-btn-text">
              <span className="guest-btn-title">Explore 3D Globe Without Sign-In</span>
              <span className="guest-btn-sub">Spin the world · Tap courts · Zero commitment</span>
            </div>
          </div>
          <span className="guest-badge">→</span>
        </button>

        <div className="login-divider">
          <span>or create an account below</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          {isSignup && !magicLink && (
            <div className="input-group">
              <label htmlFor="displayName">Player Name</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                required
              />
            </div>
          )}
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player@austin.com"
              required
            />
          </div>
          {!magicLink && (
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          )}
          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? 'Loading...' : magicLink ? 'Send Magic Link' : isSignup ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="login-nav-options">
          <button 
            type="button" 
            className="magic-link-toggle" 
            onClick={() => { setMagicLink(!magicLink); setError(''); setMessage(''); }}
          >
            {magicLink ? 'Use Password instead' : 'Sign in with Email Link (Passwordless)'}
          </button>
        </div>

        {/* Divider */}
        <div className="login-divider">
          <span>or</span>
        </div>

        {/* Google */}
        <button className="google-btn" onClick={handleGoogle} disabled={loading}>
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Toggle */}
        <p className="login-toggle">
          {isSignup ? 'Already have an account? ' : "Don't have an account? "}
          <button type="button" onClick={() => { setIsSignup(!isSignup); setMagicLink(false); setError(''); setMessage(''); }}>
            {isSignup ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
      <footer className="login-footer">
        <p>© 2026 Swami Software, LLC. All rights reserved.</p>
      </footer>
    </div>
  );
}
