/**
 * Validation Utilities
 */

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateXID = (xid) => {
  // xID should be alphanumeric
  return xid && xid.trim().length > 0;
};

export const validatePassword = (password) => {
  // Basic password validation
  return password && password.length >= 8;
};

export const validateRequired = (value) => {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
};

export const validatePAN = (pan) => {
  // PAN format: ABCDE1234F
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return !pan || panRegex.test(pan);
};

export const validateAadhaar = (aadhaar) => {
  // Aadhaar format: 12 digits
  const aadhaarRegex = /^[0-9]{12}$/;
  return !aadhaar || aadhaarRegex.test(aadhaar.replace(/\s/g, ''));
};

export const validatePhone = (phone) => {
  // Phone format: 10 digits
  const phoneRegex = /^[0-9]{10}$/;
  return !phone || phoneRegex.test(phone.replace(/[\s-]/g, ''));
};
