/**
 * Main App Component
 */

import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { Router } from './Router';
import './assets/styles/tokens.css';
import './assets/styles/neomorphic.css';
import './assets/styles/global.css';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
