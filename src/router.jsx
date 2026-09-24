import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Settings from './pages/Settings';
import DistrictCourts from './pages/DistrictCourts';
import CourtDetail from './pages/CourtDetail';
import CreateGame from './pages/CreateGame';
import ActiveGames from './pages/ActiveGames';
import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import Onboarding from './pages/Onboarding';
import Loading from './components/Loading';

function ProtectedRoute({ children }) {
  const { user, loading, isGuest } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user && !isGuest) {
    const dest = location.pathname + location.search;
    return <Navigate to={`/login?redirectTo=${encodeURIComponent(dest)}`} replace state={{ redirectTo: dest }} />;
  }
  return children;
}

export default function AppRouter() {
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
              <Settings />
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
              <Profile />
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
      </Routes>
    </BrowserRouter>
  );
}
