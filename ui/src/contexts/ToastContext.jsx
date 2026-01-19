/**
 * Enterprise Toast Context for notifications
 * Success: Auto-dismiss after 3 seconds
 * Error: Persistent until dismissed
 * Warning: Auto-dismiss after 5 seconds
 * Info: Auto-dismiss after 4 seconds
 */

import React, { createContext, useState, useCallback, useEffect } from 'react';
import { SESSION_KEYS } from '../utils/constants';

export const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', persistent = false) => {
    const id = Date.now();
    const toast = { id, message, type };
    
    setToasts((prev) => {
      // Limit to 3 toasts at a time
      const newToasts = [...prev, toast];
      return newToasts.slice(-3);
    });
    
    // Auto remove based on type
    if (!persistent) {
      const timeoutMap = {
        success: 3000,
        warning: 5000,
        info: 4000,
        danger: 0,
      };
      const timeout = timeoutMap[type] ?? 0;
      
      if (timeout > 0) {
        setTimeout(() => {
          removeToast(id);
        }, timeout);
      }
    }
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showSuccess = useCallback((message) => {
    return addToast(message, 'success', false);
  }, [addToast]);

  const showError = useCallback((message) => {
    return addToast(message, 'danger', true); // Errors are persistent
  }, [addToast]);

  const showWarning = useCallback((message) => {
    return addToast(message, 'warning', false);
  }, [addToast]);

  const showInfo = useCallback((message) => {
    return addToast(message, 'info', false);
  }, [addToast]);

  const value = {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEYS.GLOBAL_TOAST);
    if (stored) {
      try {
        const { message, type = 'info' } = JSON.parse(stored);
        addToast(message, type);
      } catch {
        // Ignore malformed payload
      } finally {
        sessionStorage.removeItem(SESSION_KEYS.GLOBAL_TOAST);
      }
    }

    const handleIdempotent = () => {
      addToast('This action was already completed earlier.', 'info');
    };

    window.addEventListener('app:idempotent', handleIdempotent);
    return () => {
      window.removeEventListener('app:idempotent', handleIdempotent);
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '80px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '420px',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`neo-alert neo-alert--${toast.type}`}
          style={{
            minWidth: '320px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            animation: 'toastSlideIn 0.2s ease-out',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
        >
          <span style={{ flex: 1, paddingRight: '12px' }}>{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '20px',
              lineHeight: '1',
              padding: '0 4px',
              color: 'inherit',
              opacity: 0.6,
            }}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      ))}
      <style>{`
        @keyframes toastSlideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
