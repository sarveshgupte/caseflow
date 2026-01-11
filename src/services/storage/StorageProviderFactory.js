const mongoose = require('mongoose');
const Firm = require('../../models/Firm.model');
const DocketraDriveProvider = require('./providers/DocketraDriveProvider');
const GoogleDriveOAuthProvider = require('./providers/GoogleDriveOAuthProvider');
const OneDriveProvider = require('./providers/OneDriveProvider');

/**
 * Storage Provider Factory
 * Resolves the correct provider based on firm storage configuration.
 */
class StorageProviderFactory {
  static async getProvider(firmOrId) {
    let firm = firmOrId;

    if (!firmOrId) {
      firm = null;
    } else if (typeof firmOrId === 'string') {
      if (mongoose.Types.ObjectId.isValid(firmOrId)) {
        firm = await Firm.findById(firmOrId);
      }
      if (!firm && !mongoose.Types.ObjectId.isValid(firmOrId)) {
        firm = await Firm.findOne({ firmId: firmOrId });
      }
    }

    const storage = firm?.storage || {};
    const mode = storage.mode || 'docketra_managed';

    if (mode === 'docketra_managed') {
      return new DocketraDriveProvider();
    }

    if (mode === 'firm_connected') {
      switch (storage.provider) {
        case 'google_drive':
          return new GoogleDriveOAuthProvider(storage.google || {});
        case 'onedrive':
          return new OneDriveProvider(storage.onedrive || {});
        default:
          throw new Error('Storage provider is required when mode is firm_connected');
      }
    }

    throw new Error(`Unsupported storage mode: ${mode}`);
  }
}

module.exports = { StorageProviderFactory };
