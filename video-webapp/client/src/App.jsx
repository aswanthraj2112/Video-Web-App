import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAuthSession, signOut as cognitoSignOut } from 'aws-amplify/auth';
import NavBar from './components/NavBar.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import api from './api.js';

export const ToastContext = createContext(() => {});

export const useToast = () => React.useContext(ToastContext);

function App () {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      const tokens = session.tokens;
      const idToken = tokens?.idToken?.toString() || '';
      if (!idToken) {
        setToken('');
        setUser(null);
        return;
      }
      const { user: profile } = await api.getMe(idToken);
      setToken(idToken);
      setUser({
        ...profile,
        idToken
      });
    } catch (error) {
      console.warn('Failed to refresh session', error);
      setToken('');
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingUser(true);
      try {
        await refreshSession();
      } finally {
        if (!cancelled) {
          setLoadingUser(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshSession]);

  const handleAuthenticated = useCallback(async () => {
    setLoadingUser(true);
    try {
      await refreshSession();
      notify('Signed in successfully', 'success');
    } finally {
      setLoadingUser(false);
    }
  }, [refreshSession, notify]);

  const handleLogout = useCallback(async () => {
    try {
      await cognitoSignOut();
    } catch (error) {
      console.warn('Sign-out failed', error);
    }
    setToken('');
    setUser(null);
    notify('Logged out', 'info');
  }, [notify]);

  const toastValue = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={toastValue}>
      <div className="app">
        <NavBar user={user} onLogout={handleLogout} />
        <main className="container">
          {token && user ? (
            <Dashboard token={token} user={user} />
          ) : (
            <Login onAuthenticated={handleAuthenticated} loading={loadingUser} />
          )}
        </main>
        {toast && (
          <div className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export default App;
