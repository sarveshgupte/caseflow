/**
 * useToast Hook
 * Provides toast notification functionality
 */

import { useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';

export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  // Map showError to 'error' type (ToastContext uses 'danger')
  const showToast = (message, type = 'info') => {
    if (type === 'error') {
      return context.showError(message);
    }
    return context.addToast(message, type);
  };

  return {
    showToast,
    showSuccess: context.showSuccess,
    showError: context.showError,
    showWarning: context.showWarning,
    showInfo: context.showInfo,
  };
};
