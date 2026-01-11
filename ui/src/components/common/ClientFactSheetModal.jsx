/**
 * Client Fact Sheet Modal Component
 * 
 * Displays client fact sheet in read-only mode from case view
 * Shows description, notes, and files with view-only access
 * No download option for files
 * 
 * PR: Client Fact Sheet Foundation
 */

import React from 'react';
import { Modal } from './Modal';
import './ClientFactSheetModal.css';

export const ClientFactSheetModal = ({ isOpen, onClose, factSheet, caseId }) => {
  if (!isOpen || !factSheet) return null;

  const handleViewFile = (fileId) => {
    // Open file in new tab for viewing (no download)
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const viewUrl = `${apiUrl}/api/cases/${caseId}/client-fact-sheet/files/${fileId}/view`;
    window.open(viewUrl, '_blank');
  };

  const hasContent = factSheet.description || factSheet.notes || (factSheet.files && factSheet.files.length > 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Client Fact Sheet" size="large">
      <div className="client-fact-sheet-modal">
        <div className="client-fact-sheet-header">
          <h3>{factSheet.businessName}</h3>
          <p className="client-id">{factSheet.clientId}</p>
        </div>

        {!hasContent && (
          <div className="no-content">
            <p>No fact sheet information available for this client.</p>
          </div>
        )}

        {factSheet.description && (
          <div className="fact-sheet-section">
            <h4>Description</h4>
            <div className="fact-sheet-content">
              {factSheet.description}
            </div>
          </div>
        )}

        {factSheet.notes && (
          <div className="fact-sheet-section">
            <h4>Internal Notes</h4>
            <div className="fact-sheet-content notes">
              {factSheet.notes}
            </div>
          </div>
        )}

        {factSheet.files && factSheet.files.length > 0 && (
          <div className="fact-sheet-section">
            <h4>Files</h4>
            <div className="files-list">
              {factSheet.files.map((file) => (
                <div key={file.fileId} className="file-item">
                  <div className="file-info">
                    <span className="file-icon">📄</span>
                    <div className="file-details">
                      <span className="file-name">{file.fileName}</span>
                      <span className="file-date">
                        Uploaded: {new Date(file.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    className="btn-view-file"
                    onClick={() => handleViewFile(file.fileId)}
                    title="View file (opens in new tab)"
                  >
                    👁️ View
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
