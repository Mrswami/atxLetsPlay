import { AuthProvider } from './contexts/AuthContext';
import AppRouter from './router';

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
