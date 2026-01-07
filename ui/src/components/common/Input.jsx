/**
 * Input Component
 */

import React from 'react';

export const Input = ({
  label,
  error,
  disabled = false,
  readOnly = false,
  required = false,
  className = '',
  ...props
}) => {
  const fieldClass = readOnly || disabled ? 'field-readonly' : '';
  
  return (
    <div className={`neo-form-group ${className}`}>
      {label && (
        <label className="neo-form-label">
          {label}
          {required && <span style={{ color: 'var(--accent-danger)' }}> *</span>}
          {(readOnly || disabled) && ' 🔒'}
        </label>
      )}
      <div className={fieldClass}>
        <input
          className="neo-input"
          disabled={disabled}
          readOnly={readOnly}
          {...props}
        />
      </div>
      {error && <div className="neo-form-error">{error}</div>}
    </div>
  );
};
