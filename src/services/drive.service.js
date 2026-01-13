/**
 * Google Drive Service
 * 
 * Handles all Google Drive API interactions using Service Account authentication.
 * Provides methods for folder creation, file upload, and file streaming.
 * 
 * Requirements:
 * - GOOGLE_SERVICE_ACCOUNT_JSON environment variable (full JSON credentials)
 * - DRIVE_ROOT_FOLDER_ID environment variable
 * - No OAuth, no user consent, no public links
 * 
 * Security:
 * - Service Account authentication only
 * - No direct Drive URLs exposed to frontend
 * - All access via backend APIs
 */

const { google } = require('googleapis');
const { allow, recordFailure, recordSuccess } = require('./circuitBreaker.service');

class DriveService {
  constructor() {
    this.drive = null;
    this.rootFolderId = null;
    this._initialized = false;
  }

  /**
   * Initialize Google Drive client
   * Validates environment variables and creates authenticated Drive client
   * 
   * @throws {Error} If credentials are missing or invalid
   */
  initialize() {
    if (this._initialized) {
      return;
    }

    // Validate environment variables
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID;

    if (!serviceAccountJson) {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_JSON environment variable is required. ' +
        'Please set it to the full JSON contents of your service account credentials.'
      );
    }

    if (!rootFolderId) {
      throw new Error(
        'DRIVE_ROOT_FOLDER_ID environment variable is required. ' +
        'Please set it to the Google Drive folder ID where case files should be stored.'
      );
    }

    // Parse service account credentials
    let credentials;
    try {
      credentials = JSON.parse(serviceAccountJson);
    } catch (error) {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. ' +
        'Please ensure it contains the complete service account credentials. ' +
        `Parse error: ${error.message}`
      );
    }

    // Validate required fields in credentials
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_JSON is missing required fields (client_email or private_key). ' +
        'Please ensure you have copied the complete service account JSON.'
      );
    }

    // Create auth client using credentials directly (not keyFile)
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    // Initialize Drive API client
    this.drive = google.drive({ version: 'v3', auth });
    this.rootFolderId = rootFolderId;
    this._initialized = true;

    console.log('[DriveService] Initialized successfully');
  }

  /**
   * Ensure service is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this._initialized) {
      this.initialize();
    }
  }

  _guardCircuit() {
    if (!allow('drive')) {
      const error = new Error('Google Drive temporarily unavailable');
      error.code = 'DRIVE_CIRCUIT_OPEN';
      throw error;
    }
  }

  /**
   * Create a folder in Google Drive
   * 
   * @param {string} folderName - Name of the folder to create
   * @param {string} parentFolderId - Parent folder ID (defaults to root)
   * @returns {Promise<string>} Created folder ID
   * @throws {Error} If folder creation fails
   */
  async createFolder(folderName, parentFolderId = null) {
    this._ensureInitialized();
    this._guardCircuit();

    const parent = parentFolderId || this.rootFolderId;

    try {
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parent],
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, name',
      });

      // Guard folder ID logging in production
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DriveService] Created folder: ${folderName} (ID: ${response.data.id})`);
      } else {
        console.log(`[DriveService] Created folder: ${folderName}`);
      }
      recordSuccess('drive');
      return response.data.id;
    } catch (error) {
      recordFailure('drive');
      console.error(`[DriveService] Error creating folder ${folderName}:`, error.message);
      throw new Error(`Failed to create folder in Google Drive: ${error.message}`);
    }
  }

  /**
   * Check if a folder exists by name in a parent folder
   * 
   * @param {string} folderName - Name of the folder to search for
   * @param {string} parentFolderId - Parent folder ID to search in
   * @returns {Promise<string|null>} Folder ID if found, null otherwise
   */
  async findFolderByName(folderName, parentFolderId = null) {
    this._ensureInitialized();
    this._guardCircuit();

    const parent = parentFolderId || this.rootFolderId;

    try {
      // Escape special characters in folder name to prevent query injection
      // Escape backslashes first, then single quotes
      const escapedFolderName = folderName
        .replace(/\\/g, '\\\\')  // Escape backslashes
        .replace(/'/g, "\\'");    // Escape single quotes
      
      const response = await this.drive.files.list({
        q: `name='${escapedFolderName}' and '${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 1,
      });

      if (response.data.files && response.data.files.length > 0) {
        recordSuccess('drive');
        return response.data.files[0].id;
      }

      return null;
    } catch (error) {
      recordFailure('drive');
      console.error(`[DriveService] Error finding folder ${folderName}:`, error.message);
      return null;
    }
  }

  /**
   * Get or create a folder (idempotent operation)
   * 
   * @param {string} folderName - Name of the folder
   * @param {string} parentFolderId - Parent folder ID (defaults to root)
   * @returns {Promise<string>} Folder ID (existing or newly created)
   */
  async getOrCreateFolder(folderName, parentFolderId = null) {
    this._ensureInitialized();
    this._guardCircuit();

    const parent = parentFolderId || this.rootFolderId;

    // Try to find existing folder first
    const existingId = await this.findFolderByName(folderName, parent);
    if (existingId) {
      // Guard folder ID logging in production
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DriveService] Found existing folder: ${folderName} (ID: ${existingId})`);
      } else {
        console.log(`[DriveService] Found existing folder: ${folderName}`);
      }
      return existingId;
    }

    // Create new folder if not found
    return await this.createFolder(folderName, parent);
  }

  /**
   * Upload a file to Google Drive
   * 
   * @param {Buffer|Stream} fileContent - File content as buffer or stream
   * @param {string} fileName - Original filename
   * @param {string} mimeType - MIME type of the file
   * @param {string} folderId - Folder ID where file should be uploaded
   * @returns {Promise<Object>} File metadata { id, name, mimeType, size }
   * @throws {Error} If upload fails
   */
  async uploadFile(fileContent, fileName, mimeType, folderId) {
    this._ensureInitialized();
    this._guardCircuit();

    try {
      const fileMetadata = {
        name: fileName,
        parents: [folderId],
      };

      const media = {
        mimeType: mimeType,
        body: fileContent,
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, mimeType, size',
      });

      // Guard file ID logging in production
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DriveService] Uploaded file: ${fileName} (ID: ${response.data.id})`);
      } else {
        console.log(`[DriveService] Uploaded file: ${fileName}`);
      }
      recordSuccess('drive');
      return {
        id: response.data.id,
        name: response.data.name,
        mimeType: response.data.mimeType,
        size: response.data.size,
      };
    } catch (error) {
      recordFailure('drive');
      console.error(`[DriveService] Error uploading file ${fileName}:`, error.message);
      throw new Error(`Failed to upload file to Google Drive: ${error.message}`);
    }
  }

  /**
   * Download a file from Google Drive as a stream
   * 
   * @param {string} fileId - Google Drive file ID
   * @returns {Promise<Stream>} File content stream
   * @throws {Error} If download fails
   */
  async downloadFile(fileId) {
    this._ensureInitialized();
    this._guardCircuit();

    try {
      const response = await this.drive.files.get(
        {
          fileId: fileId,
          alt: 'media',
        },
        {
          responseType: 'stream',
        }
      );

      recordSuccess('drive');
      return response.data;
    } catch (error) {
      recordFailure('drive');
      console.error(`[DriveService] Error downloading file ${fileId}:`, error.message);
      throw new Error(`Failed to download file from Google Drive: ${error.message}`);
    }
  }

  /**
   * Get file metadata from Google Drive
   * 
   * @param {string} fileId - Google Drive file ID
   * @returns {Promise<Object>} File metadata { id, name, mimeType, size }
   * @throws {Error} If file not found or request fails
   */
  async getFileMetadata(fileId) {
    this._ensureInitialized();
    this._guardCircuit();

    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size',
      });

      recordSuccess('drive');
      return {
        id: response.data.id,
        name: response.data.name,
        mimeType: response.data.mimeType,
        size: response.data.size,
      };
    } catch (error) {
      recordFailure('drive');
      console.error(`[DriveService] Error getting file metadata ${fileId}:`, error.message);
      throw new Error(`Failed to get file metadata from Google Drive: ${error.message}`);
    }
  }

  /**
   * Delete a file from Google Drive
   * 
   * @param {string} fileId - Google Drive file ID
   * @returns {Promise<void>}
   * @throws {Error} If deletion fails
   */
  async deleteFile(fileId) {
    this._ensureInitialized();
    this._guardCircuit();

    try {
      await this.drive.files.delete({
        fileId: fileId,
      });

      console.log(`[DriveService] Deleted file: ${fileId}`);
    } catch (error) {
      recordFailure('drive');
      console.error(`[DriveService] Error deleting file ${fileId}:`, error.message);
      throw new Error(`Failed to delete file from Google Drive: ${error.message}`);
    }
  }
}

// Export singleton instance
const driveService = new DriveService();

module.exports = driveService;
