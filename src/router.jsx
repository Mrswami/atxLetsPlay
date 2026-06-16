import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Settings from './pages/Settings';
import DistrictCourts from './pages/DistrictCourts';
import CourtDetail from './pages/CourtDetail';
import CreateGame from './pages/CreateGame';
import ActiveGames from './pages/ActiveGames';
import Loading from './components/Loading';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
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
        {/* Active games browser — public */}
        <Route path="/active-games" element={<ActiveGames />} />
        {/* District drill-down — public */}
        <Route path="/district/:districtId" element={<DistrictCourts />} />
        {/* Court detail — public */}
        <Route path="/court/:courtId" element={<CourtDetail />} />
      </Routes>
    </BrowserRouter>
  );
}
