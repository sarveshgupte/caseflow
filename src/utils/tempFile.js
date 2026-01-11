/**
 * Temporary File Utilities
 * 
 * Provides helper functions for managing temporary files during uploads.
 */

const fs = require('fs').promises;

/**
 * Clean up a temporary file
 * Safely deletes a file and logs any errors without throwing
 * 
 * @param {string} filePath - Path to the temporary file
 * @returns {Promise<void>}
 */
const cleanupTempFile = async (filePath) => {
  if (!filePath) {
    return;
  }
  
  try {
    await fs.unlink(filePath);
    console.log(`[TempFile] Cleaned up temporary file: ${filePath}`);
  } catch (error) {
    console.error(`[TempFile] Error deleting temp file ${filePath}:`, error.message);
  }
};

module.exports = {
  cleanupTempFile,
};
