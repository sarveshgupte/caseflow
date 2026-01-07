/**
 * Select Component
 */

import React from 'react';

export const Select = ({
  label,
  error,
  options = [],
  disabled = false,
  required = false,
  className = '',
  ...props
}) => {
  return (
    <div className={`neo-form-group ${className}`}>
      {label && (
        <label className="neo-form-label">
          {label}
          {required && <span style={{ color: 'var(--accent-danger)' }}> *</span>}
        </label>
      )}
      <select className="neo-select" disabled={disabled} {...props}>
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <div className="neo-form-error">{error}</div>}
    </div>
  );
};
