/**
 * Main App Component
 */

import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
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
    bootstrapAuth(fetchProfile).catch((error) => {
      console.error('[AUTH] bootstrap failed', error);
    });
  }, [fetchProfile]);

  return (
    <ToastProvider>
      <Router />
    </ToastProvider>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppBootstrap />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
