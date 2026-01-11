/**
 * CFS (Case File System) Drive Service
 * 
 * Manages the Google Drive folder structure for case files.
 * Implements the mandatory folder architecture:
 * 
 * <DRIVE_ROOT_FOLDER_ID>/
 *  └─ firm_<firmId>/
 *      └─ cfs_<caseId>/
 *          ├─ attachments/
 *          ├─ documents/
 *          ├─ evidence/
 *          └─ internal/
 * 
 * Features:
 * - Idempotent folder creation (safe to call multiple times)
 * - Firm-scoped isolation
 * - Case-scoped CFS roots
 * - Persists folder IDs in database
 * 
 * Security:
 * - Never relies on folder names for access control
 * - Always uses folder IDs for authorization
 */

const driveService = require('./drive.service');

class CFSDriveService {
  /**
   * CFS subfolder names
   * These are the standard subfolders created for each case
   */
  static CFS_SUBFOLDERS = {
    ATTACHMENTS: 'attachments',
    DOCUMENTS: 'documents',
    EVIDENCE: 'evidence',
    INTERNAL: 'internal',
  };

  /**
   * Ensure firm folder exists under root
   * 
   * @param {string} firmId - Firm identifier
   * @returns {Promise<string>} Firm folder ID
   */
  async ensureFirmFolder(firmId) {
    if (!firmId) {
      throw new Error('Firm ID is required');
    }

    const folderName = `firm_${firmId}`;
    const folderId = await driveService.getOrCreateFolder(folderName);
    
    return folderId;
  }

  /**
   * Create complete CFS folder structure for a case
   * 
   * Creates the following structure:
   * - firm_<firmId>/cfs_<caseId>/
   *   - attachments/
   *   - documents/
   *   - evidence/
   *   - internal/
   * 
   * @param {string} firmId - Firm identifier
   * @param {string} caseId - Case identifier (human-readable, e.g., CASE-20260111-00001)
   * @returns {Promise<Object>} Folder IDs
   * @throws {Error} If folder creation fails
   */
  async createCFSFolderStructure(firmId, caseId) {
    if (!firmId || !caseId) {
      throw new Error('Firm ID and Case ID are required');
    }

    console.log(`[CFSDriveService] Creating CFS folder structure for firm=${firmId}, case=${caseId}`);

    try {
      // Step 1: Ensure firm folder exists
      const firmFolderId = await this.ensureFirmFolder(firmId);

      // Step 2: Create CFS root folder for this case
      const cfsRootName = `cfs_${caseId}`;
      const cfsRootFolderId = await driveService.getOrCreateFolder(cfsRootName, firmFolderId);

      // Step 3: Create all subfolders in parallel
      const [attachmentsFolderId, documentsFolderId, evidenceFolderId, internalFolderId] = 
        await Promise.all([
          driveService.getOrCreateFolder(CFSDriveService.CFS_SUBFOLDERS.ATTACHMENTS, cfsRootFolderId),
          driveService.getOrCreateFolder(CFSDriveService.CFS_SUBFOLDERS.DOCUMENTS, cfsRootFolderId),
          driveService.getOrCreateFolder(CFSDriveService.CFS_SUBFOLDERS.EVIDENCE, cfsRootFolderId),
          driveService.getOrCreateFolder(CFSDriveService.CFS_SUBFOLDERS.INTERNAL, cfsRootFolderId),
        ]);

      const folderIds = {
        firmRootFolderId: firmFolderId,
        cfsRootFolderId: cfsRootFolderId,
        attachmentsFolderId: attachmentsFolderId,
        documentsFolderId: documentsFolderId,
        evidenceFolderId: evidenceFolderId,
        internalFolderId: internalFolderId,
      };

      console.log(`[CFSDriveService] Successfully created CFS structure:`, folderIds);

      return folderIds;
    } catch (error) {
      console.error(`[CFSDriveService] Error creating CFS structure:`, error);
      throw new Error(`Failed to create CFS folder structure: ${error.message}`);
    }
  }

  /**
   * Get the appropriate folder ID for a file type
   * 
   * @param {Object} folderIds - CFS folder IDs object
   * @param {string} fileType - Type of file ('attachment', 'document', 'evidence', 'internal')
   * @returns {string} Folder ID for the file type
   */
  getFolderIdForFileType(folderIds, fileType = 'attachment') {
    if (!folderIds) {
      throw new Error('Folder IDs object is required');
    }

    // Default to attachments folder
    const folderMap = {
      'attachment': folderIds.attachmentsFolderId,
      'document': folderIds.documentsFolderId,
      'evidence': folderIds.evidenceFolderId,
      'internal': folderIds.internalFolderId,
    };

    const folderId = folderMap[fileType.toLowerCase()] || folderIds.attachmentsFolderId;

    if (!folderId) {
      throw new Error(`No folder ID found for file type: ${fileType}`);
    }

    return folderId;
  }

  /**
   * Validate CFS folder structure exists
   * Can be used to check if folders were properly created
   * 
   * @param {Object} folderIds - CFS folder IDs object
   * @returns {Promise<boolean>} True if all folders are valid
   */
  async validateCFSStructure(folderIds) {
    if (!folderIds) {
      return false;
    }

    const requiredFolders = [
      'firmRootFolderId',
      'cfsRootFolderId',
      'attachmentsFolderId',
      'documentsFolderId',
      'evidenceFolderId',
      'internalFolderId',
    ];

    // Check all required folder IDs are present
    for (const folderKey of requiredFolders) {
      if (!folderIds[folderKey]) {
        console.error(`[CFSDriveService] Missing folder ID: ${folderKey}`);
        return false;
      }
    }

    return true;
  }
}

// Export singleton instance
const cfsDriveService = new CFSDriveService();

module.exports = cfsDriveService;
