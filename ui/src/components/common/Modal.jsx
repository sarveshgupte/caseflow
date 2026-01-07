/**
 * Modal Component
 */

import React, { useEffect } from 'react';
import { Button } from './Button';

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  actions,
  size = 'md',
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const sizeStyle = size === 'lg' ? { maxWidth: '900px' } : {};

  return (
    <div className="neo-modal-overlay" onClick={handleOverlayClick}>
      <div className="neo-modal" style={sizeStyle}>
        <div className="neo-modal__header">{title}</div>
        <div>{children}</div>
        {actions && <div className="neo-modal__actions">{actions}</div>}
      </div>
    </div>
  );
};
