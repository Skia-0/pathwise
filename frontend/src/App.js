import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Diagnostic from './pages/Diagnostic';
import Dashboard from './pages/Dashboard';
import Practice from './pages/Practice';
import Summariser from './pages/Summariser';

function PrivateRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return token ? children : <Navigate to="/login" />;
}

// Sends students back to the diagnostic until they have finished it for the
// subject they are currently on. The server is asked every time a page opens.
function RequireDiagnostic({ children }) {
  const { user, refreshUser } = useAuth();
  const location = useLocation();
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setVerified(false);
    refreshUser()
      .catch(() => null) // offline: fall back to the stored user
      .finally(() => {
        if (!cancelled) setVerified(true);
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname, refreshUser]);

  const hasTier = Boolean(user?.aptitude_tier);

  if (!hasTier) {
    return verified ? (
      <Navigate to="/diagnostic" replace />
    ) : (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
        Checking your progress...
      </div>
    );
  }
  return children;
}

function Guarded({ children }) {
  return (
    <PrivateRoute>
      <RequireDiagnostic>{children}</RequireDiagnostic>
    </PrivateRoute>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/diagnostic" element={
            <PrivateRoute><Diagnostic /></PrivateRoute>
          } />
          <Route path="/dashboard" element={<Guarded><Dashboard /></Guarded>} />
          <Route path="/practice" element={<Guarded><Practice /></Guarded>} />
          <Route path="/summariser" element={<Guarded><Summariser /></Guarded>} />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;