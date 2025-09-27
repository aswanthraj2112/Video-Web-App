import React, { createContext, useCallback, useMemo, useState } from 'react';
import NavBar from './components/NavBar.jsx';
import Dashboard from './pages/Dashboard.jsx';

export const ToastContext = createContext(() => {});
export const useToast = () => React.useContext(ToastContext);

// Development mode component - bypasses authentication
function DevApp() {
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Mock user for development
  const mockUser = {
    username: 'dev-user',
    email: 'dev@example.com'
  };

  const mockToken = 'dev-token-123';

  const handleLogout = useCallback(() => {
    notify('Logout disabled in development mode', 'info');
  }, [notify]);

  const toastValue = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={toastValue}>
      <div className="app">
        <NavBar user={mockUser} onLogout={handleLogout} />
        <main className="container">
          <div style={{ 
            padding: '20px', 
            backgroundColor: 'rgba(59, 130, 246, 0.1)', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}>
            <h3 style={{ color: '#3b82f6', margin: '0 0 10px 0' }}>🚧 Development Mode</h3>
            <p style={{ margin: 0, color: '#cbd5f5' }}>
              Running with mock authentication. Cognito User Pool configuration required for production.
            </p>
          </div>
          <Dashboard token={mockToken} user={mockUser} />
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

export default DevApp;