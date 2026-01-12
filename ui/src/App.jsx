/**
 * Main App Component
 */

import React, { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { Router } from './Router';
import { useAuth } from './hooks/useAuth';
import { bootstrapAuth } from './auth/authBootstrap';
import './assets/styles/enterprise.css';
import './assets/styles/neomorphic.css';
import './assets/styles/global.css';

const AppBootstrap = () => {
  const { fetchProfile } = useAuth();

  useEffect(() => {
    bootstrapAuth(fetchProfile).catch(() => {});
  }, [fetchProfile]);

  return (
    <ToastProvider>
      <Router />
    </ToastProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppBootstrap />
    </AuthProvider>
  );
}

export default App;
