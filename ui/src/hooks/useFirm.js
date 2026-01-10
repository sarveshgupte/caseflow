/**
 * useFirm Hook
 * Access firm context
 */

import { useContext } from 'react';
import { FirmContext } from '../contexts/FirmContext';

export const useFirm = () => {
  const context = useContext(FirmContext);
  
  if (!context) {
    throw new Error('useFirm must be used within a FirmProvider');
  }
  
  return context;
};
