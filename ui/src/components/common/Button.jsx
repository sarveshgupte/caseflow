/**
 * Button Component
 */

import React from 'react';

export const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'default',
  disabled = false,
  className = '',
  ...props
}) => {
  const variantClass = variant !== 'default' ? `neo-button--${variant}` : '';
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`neo-button ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
