/**
 * Textarea Component
 */

import React from 'react';

export const Textarea = ({
  label,
  error,
  disabled = false,
  readOnly = false,
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
      <textarea
        className="neo-textarea"
        disabled={disabled}
        readOnly={readOnly}
        {...props}
      />
      {error && <div className="neo-form-error">{error}</div>}
    </div>
  );
};
