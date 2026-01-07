/**
 * Loading Spinner Component
 */

import React from 'react';

export const Loading = ({ message = 'Loading...' }) => {
  return (
    <div className="flex flex-col items-center justify-center" style={{ padding: 'var(--spacing-2xl)' }}>
      <div className="neo-spinner"></div>
      <p className="text-secondary" style={{ marginTop: 'var(--spacing-md)' }}>
        {message}
      </p>
    </div>
  );
};
