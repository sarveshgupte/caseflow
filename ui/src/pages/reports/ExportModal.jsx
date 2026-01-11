/**
 * ExportModal Component
 * Confirmation modal for exporting reports
 */

import React from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { formatDate } from '../../utils/formatters';
import './ExportModal.css';

export const ExportModal = ({
  isOpen,
  onClose,
  onConfirm,
  exportType,
  filters,
  recordCount,
  loading,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Docketra Report">
      <div className="export-modal">
        <div className="export-modal__content">
          <p className="export-modal__text">
            You are about to export <strong>{recordCount}</strong> records as{' '}
            <strong>{exportType === 'csv' ? 'CSV' : 'Excel'}</strong>.
          </p>
          
          {(filters.fromDate || filters.toDate || filters.status || filters.category) && (
            <div className="export-modal__filters">
              <h4>Applied Filters:</h4>
              <ul>
                {filters.fromDate && (
                  <li>
                    <strong>From Date:</strong> {formatDate(filters.fromDate)}
                  </li>
                )}
                {filters.toDate && (
                  <li>
                    <strong>To Date:</strong> {formatDate(filters.toDate)}
                  </li>
                )}
                {filters.status && (
                  <li>
                    <strong>Status:</strong> {filters.status}
                  </li>
                )}
                {filters.category && (
                  <li>
                    <strong>Category:</strong> {filters.category}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
        
        <div className="export-modal__actions">
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={loading}>
            {loading ? 'Exporting...' : 'Confirm Export'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
