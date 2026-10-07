import { AuthProvider } from './contexts/AuthContext';
import AppRouter from './router';
import InAppBrowserWarning from './components/InAppBrowserWarning';

export default function App() {
  return (
    <AuthProvider>
      <InAppBrowserWarning />
      <AppRouter />
    </AuthProvider>
  );
}
