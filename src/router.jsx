import React, { Component, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', background: '#222', color: '#fff', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2>Component Crashed!</h2>
          <p style={{ color: '#ff4d4f' }}>{this.state.error && this.state.error.toString()}</p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#111', padding: '1rem', marginTop: '1rem' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

import { useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Settings from './pages/Settings';
import DistrictCourts from './pages/DistrictCourts';
import CourtDetail from './pages/CourtDetail';
import CreateGame from './pages/CreateGame';
import ActiveGames from './pages/ActiveGames';
import Profile from './pages/Profile';
import Friends from './pages/Friends';
import Leaderboard from './pages/Leaderboard';
import Onboarding from './pages/Onboarding';
import LiveGame from './pages/LiveGame';
import Loading from './components/Loading';

function ProtectedRoute({ children }) {
  const { user, userProfile, loading, isGuest } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user && !isGuest) {
    const dest = location.pathname + location.search;
    return <Navigate to={`/login?redirectTo=${encodeURIComponent(dest)}`} replace state={{ redirectTo: dest }} />;
  }
  if (userProfile && userProfile.hasCompletedOnboarding === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}

export default function AppRouter() {
  const { loading } = useAuth();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [initialBoot, setInitialBoot] = useState(true);

  useEffect(() => {
    // Force at least 4 seconds for the initial pre-loader
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const isAppReady = !loading && minTimeElapsed;

  useEffect(() => {
    if (isAppReady && initialBoot) {
      const loader = document.getElementById('pre-loader-container');
      if (loader) {
        loader.style.opacity = '0';
        loader.style.transition = 'opacity 0.5s ease-out';
        setTimeout(() => {
          loader.remove();
          setInitialBoot(false);
        }, 500);
      } else {
        setInitialBoot(false);
      }
    }
  }, [isAppReady, initialBoot]);

  if (!isAppReady && initialBoot) {
    return null; // The index.html pre-loader is handling it
  }

  if (loading && !initialBoot) {
    return <Loading />; // For any subsequent loading states
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Home & World are open to everyone — no sign-in wall */}
        <Route path="/" element={<Home />} />
        <Route path="/world" element={<Home />} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <Settings />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        <Route
          path="/create-game/:courtId"
          element={
            <ProtectedRoute>
              <CreateGame />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:uid"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <Profile />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />
        {/* Active games browser — public */}
        <Route path="/active-games" element={<ActiveGames />} />
        {/* Leaderboard — public */}
        <Route path="/leaderboard" element={<Leaderboard />} />
        {/* District drill-down — public */}
        <Route path="/district/:districtId" element={<DistrictCourts />} />
        {/* Court detail — public */}
        <Route path="/court/:courtId" element={<CourtDetail />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/live-game/:gameId" element={<LiveGame />} />
      </Routes>
    </BrowserRouter>
  );
}
