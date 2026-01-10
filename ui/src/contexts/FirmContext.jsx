/**
 * Firm Context
 * Manages firm slug for firm-scoped routing
 */

import React, { createContext, useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';

export const FirmContext = createContext(null);

export const FirmProvider = ({ children }) => {
  const params = useParams();
  const location = useLocation();
  const [firmSlug, setFirmSlug] = useState(null);

  useEffect(() => {
    // Extract firmSlug from URL params
    if (params.firmSlug) {
      setFirmSlug(params.firmSlug);
      // Store in sessionStorage to persist across navigation
      sessionStorage.setItem('firmSlug', params.firmSlug);
    } else {
      // Try to restore from sessionStorage if not in URL
      const stored = sessionStorage.getItem('firmSlug');
      if (stored) {
        setFirmSlug(stored);
      }
    }
  }, [params.firmSlug, location.pathname]);

  const clearFirmSlug = () => {
    setFirmSlug(null);
    sessionStorage.removeItem('firmSlug');
  };

  const value = {
    firmSlug,
    setFirmSlug,
    clearFirmSlug,
  };

  return <FirmContext.Provider value={value}>{children}</FirmContext.Provider>;
};
