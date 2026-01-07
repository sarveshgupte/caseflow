/**
 * Card Component
 */

import React from 'react';

export const Card = ({ children, className = '', onClick, ...props }) => {
  return (
    <div
      className={`neo-card ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      {...props}
    >
      {children}
    </div>
  );
};
