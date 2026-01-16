/**
 * Enterprise Input Component
 * Supports validation, error states, help text
 * Read-only fields render as text, not disabled inputs
 */

import React, { useState } from 'react';

export const Input = ({
  label,
  error,
  helpText,
  disabled = false,
  readOnly = false,
  required = false,
  className = '',
  value,
  type = 'text',
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordType = type === 'password';
  const resolvedType = isPasswordType ? (showPassword ? 'text' : 'password') : type;

  // If read-only, render as static text instead of disabled input
  if (readOnly && value !== undefined) {
    return (
      <div className={`form-group ${className}`}>
        {label && (
          <label className="form-label">
            {label}
            {required && <span className="text-danger"> *</span>}
          </label>
        )}
        <div className="flex items-center gap-2 py-2 text-text-body">
          <span>{value || '-'}</span>
          <span className="text-text-muted text-xs">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 1C4.34 1 3 2.34 3 4V5H2.5C1.67 5 1 5.67 1 6.5V10.5C1 11.33 1.67 12 2.5 12H9.5C10.33 12 11 11.33 11 10.5V6.5C11 5.67 10.33 5 9.5 5H9V4C9 2.34 7.66 1 6 1ZM6 2C7.11 2 8 2.89 8 4V5H4V4C4 2.89 4.89 2 6 2Z"/>
            </svg>
          </span>
        </div>
        {helpText && <div className="form-help">{helpText}</div>}
      </div>
    );
  }
  
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
      )}
      <div className={`input-wrapper ${isPasswordType ? 'input-wrapper--password' : ''}`}>
        <input
          className={`input ${error ? 'input-error' : ''} ${isPasswordType ? 'input-with-toggle' : ''}`}
          disabled={disabled}
          value={value}
          type={resolvedType}
          {...props}
        />
        {isPasswordType && (
          <button
            type="button"
            className="input-toggle"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M3 3l18 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10.58 10.58a3 3 0 004.16 4.16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.88 4.24A9.55 9.55 0 0121 12s-3 5-9 5a9.42 9.42 0 01-2.35-.29"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6.12 6.12A9.53 9.53 0 003 12s3 5 9 5a9.59 9.59 0 004.77-1.23"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && <div className="form-error">{error}</div>}
      {!error && helpText && <div className="form-help">{helpText}</div>}
    </div>
  );
};
