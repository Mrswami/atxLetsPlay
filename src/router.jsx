import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Settings from './pages/Settings';
import DistrictCourts from './pages/DistrictCourts';
import CourtDetail from './pages/CourtDetail';
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
        {/* District drill-down — public (no auth required) */}
        <Route path="/district/:districtId" element={<DistrictCourts />} />
        {/* Court detail — public */}
        <Route path="/court/:courtId" element={<CourtDetail />} />
      </Routes>
    </BrowserRouter>
  );
}
