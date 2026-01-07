/**
 * useApi Hook
 * Generic hook for API calls with loading and error states
 */

import { useState, useCallback } from 'react';
import { useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const toast = useContext(ToastContext);

  const execute = useCallback(async (apiCall, options = {}) => {
    const {
      onSuccess,
      onError,
      showSuccessToast = false,
      showErrorToast = true,
      successMessage = 'Operation completed successfully',
    } = options;

    setLoading(true);
    setError(null);

    try {
      const response = await apiCall();
      
      if (showSuccessToast && toast) {
        toast.showSuccess(successMessage);
      }
      
      if (onSuccess) {
        onSuccess(response);
      }
      
      return response;
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred';
      setError(errorMessage);
      
      if (showErrorToast && toast) {
        toast.showError(errorMessage);
      }
      
      if (onError) {
        onError(err);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    loading,
    error,
    execute,
  };
};
