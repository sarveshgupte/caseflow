const Client = require('../models/Client.model');

/**
 * Client Duplicate Detector Service
 * PART F - Duplicate Client Warning for "Client – New" Cases
 * 
 * Detects potential duplicate clients using exact and fuzzy matching
 * Returns matches with similarity scores and matching fields
 * 
 * Detection Signals:
 * - Exact match: PAN, GST, CIN
 * - Fuzzy match: Business name, Business address
 * - Match: Phone number, Email address
 */

/**
 * Normalize string for fuzzy comparison
 * Removes extra spaces, converts to lowercase, removes special characters
 * 
 * @param {string} str - String to normalize
 * @returns {string} Normalized string
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize spaces
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity score between two strings (0-100)
 * 
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-100)
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const normalized1 = normalizeString(str1);
  const normalized2 = normalizeString(str2);
  
  if (normalized1 === normalized2) return 100;
  
  const maxLength = Math.max(normalized1.length, normalized2.length);
  if (maxLength === 0) return 100;
  
  const distance = levenshteinDistance(normalized1, normalized2);
  const similarity = ((maxLength - distance) / maxLength) * 100;
  
  return Math.round(similarity);
}

/**
 * Detect duplicate clients based on provided data
 * 
 * @param {Object} clientData - Client data to check
 * @param {string} clientData.businessName - Business name
 * @param {string} clientData.businessAddress - Business address
 * @param {string} clientData.businessPhone - Business phone
 * @param {string} clientData.businessEmail - Business email
 * @param {string} clientData.PAN - PAN number
 * @param {string} clientData.GST - GST number
 * @param {string} clientData.CIN - CIN number
 * @returns {Promise<Object>} Detection results
 */
async function detectDuplicates(clientData) {
  try {
    const {
      businessName,
      businessAddress,
      businessPhone,
      businessEmail,
      PAN,
      GST,
      CIN,
    } = clientData;

    const matches = [];
    
    // Build query for exact matches
    const exactMatchQuery = { $or: [], isActive: true };
    
    // Exact match on PAN (if provided)
    if (PAN && PAN.trim()) {
      exactMatchQuery.$or.push({ PAN: PAN.toUpperCase().trim() });
    }
    
    // Exact match on GST (if provided)
    if (GST && GST.trim()) {
      exactMatchQuery.$or.push({ GST: GST.toUpperCase().trim() });
    }
    
    // Exact match on CIN (if provided)
    if (CIN && CIN.trim()) {
      exactMatchQuery.$or.push({ CIN: CIN.toUpperCase().trim() });
    }
    
    // Exact match on phone (if provided)
    if (businessPhone && businessPhone.trim()) {
      exactMatchQuery.$or.push({ businessPhone: businessPhone.trim() });
    }
    
    // Exact match on email (if provided)
    if (businessEmail && businessEmail.trim()) {
      exactMatchQuery.$or.push({ businessEmail: businessEmail.toLowerCase().trim() });
    }
    
    // Find exact matches
    let exactMatches = [];
    if (exactMatchQuery.$or.length > 0) {
      exactMatches = await Client.find(exactMatchQuery).lean();
    }
    
    // Process exact matches
    for (const client of exactMatches) {
      const matchedFields = [];
      
      if (PAN && client.PAN === PAN.toUpperCase().trim()) {
        matchedFields.push('PAN');
      }
      if (GST && client.GST === GST.toUpperCase().trim()) {
        matchedFields.push('GST');
      }
      if (CIN && client.CIN === CIN.toUpperCase().trim()) {
        matchedFields.push('CIN');
      }
      if (businessPhone && client.businessPhone === businessPhone.trim()) {
        matchedFields.push('Phone');
      }
      if (businessEmail && client.businessEmail === businessEmail.toLowerCase().trim()) {
        matchedFields.push('Email');
      }
      
      matches.push({
        clientId: client.clientId,
        businessName: client.businessName,
        matchedFields,
        matchType: 'exact',
        similarity: 100,
      });
    }
    
    // Fuzzy matching on business name and address
    // Only check if we have business name or address to compare
    if (businessName || businessAddress) {
      // Get all active clients for fuzzy matching
      const allClients = await Client.find({ isActive: true }).lean();
      
      for (const client of allClients) {
        // Skip if already matched exactly
        if (matches.some(m => m.clientId === client.clientId)) {
          continue;
        }
        
        const matchedFields = [];
        let maxSimilarity = 0;
        
        // Check business name similarity (threshold: 80%)
        if (businessName && client.businessName) {
          const nameSimilarity = calculateSimilarity(businessName, client.businessName);
          if (nameSimilarity >= 80) {
            matchedFields.push('Business Name');
            maxSimilarity = Math.max(maxSimilarity, nameSimilarity);
          }
        }
        
        // Check business address similarity (threshold: 80%)
        if (businessAddress && client.businessAddress) {
          const addressSimilarity = calculateSimilarity(businessAddress, client.businessAddress);
          if (addressSimilarity >= 80) {
            matchedFields.push('Business Address');
            maxSimilarity = Math.max(maxSimilarity, addressSimilarity);
          }
        }
        
        // Add to matches if any fuzzy match found
        if (matchedFields.length > 0) {
          matches.push({
            clientId: client.clientId,
            businessName: client.businessName,
            matchedFields,
            matchType: 'fuzzy',
            similarity: maxSimilarity,
          });
        }
      }
    }
    
    // Sort matches by similarity (highest first)
    matches.sort((a, b) => b.similarity - a.similarity);
    
    return {
      hasDuplicates: matches.length > 0,
      matchCount: matches.length,
      matches,
    };
  } catch (error) {
    throw new Error(`Error detecting duplicates: ${error.message}`);
  }
}

/**
 * Generate system comment for duplicate override
 * 
 * @param {Array} matches - Array of matched clients
 * @returns {string} Formatted system comment
 */
function generateDuplicateOverrideComment(matches) {
  const matchedClientIds = matches.map(m => m.clientId).join(', ');
  const matchedFields = [...new Set(matches.flatMap(m => m.matchedFields))].join(', ');
  
  const comment = `⚠️ System Notice:
Possible duplicate client detected.
Matched fields: ${matchedFields}.
Existing Client IDs: ${matchedClientIds}.
User chose to proceed anyway.`;
  
  return comment;
}

module.exports = {
  detectDuplicates,
  generateDuplicateOverrideComment,
  calculateSimilarity,
};
