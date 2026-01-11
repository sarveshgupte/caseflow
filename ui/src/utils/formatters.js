/**
 * Formatting Utilities
 */

import { CLIENT_STATUS } from './constants';

/**
 * Format date as DD/MM/YYYY
 * Centralized formatter to ensure consistency across the application
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Format date and time as DD/MM/YYYY HH:MM
 * Centralized formatter to ensure consistency across the application
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export const formatCaseName = (caseName) => {
  return caseName || 'N/A';
};

export const formatStatus = (status) => {
  if (!status) return 'N/A';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export const getStatusColor = (status) => {
  const statusLower = status?.toLowerCase();
  switch (statusLower) {
    case 'open':
      return 'primary';
    case 'pending':
      return 'warning';
    case 'closed':
      return 'success';
    case 'filed':
      return 'success';
    default:
      return 'secondary';
  }
};

export const truncate = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Format client display as: <ClientID> – <BusinessName>
 * Example: C000002 – Gupte Enterprises OPC Pvt Ltd
 * 
 * @param {Object} client - Client object with clientId and businessName
 * @param {boolean} showInactiveLabel - Whether to append (Inactive) for inactive clients
 * @returns {string} Formatted client display string
 */
export const formatClientDisplay = (client, showInactiveLabel = false) => {
  if (!client) return 'N/A';
  
  const clientId = client.clientId || '';
  const businessName = client.businessName || '';
  
  if (!clientId && !businessName) return 'N/A';
  if (!clientId) return businessName;
  if (!businessName) return clientId;
  
  let display = `${clientId} – ${businessName}`;
  
  // Append inactive label if client is not active
  // Use status field as the canonical field (per Client model)
  if (showInactiveLabel && client.status !== CLIENT_STATUS.ACTIVE) {
    display += ' (Inactive)';
  }
  
  return display;
};
