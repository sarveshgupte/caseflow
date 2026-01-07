/**
 * Badge Component
 */

import React from 'react';
import { getStatusColor } from '../../utils/formatters';

export const Badge = ({ children, variant, status }) => {
  // If status is provided, use it to determine variant
  const badgeVariant = status ? getStatusColor(status) : variant;
  const variantClass = badgeVariant ? `neo-badge--${badgeVariant}` : '';
  
  return <span className={`neo-badge ${variantClass}`}>{children}</span>;
};
