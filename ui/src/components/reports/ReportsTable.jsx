/**
 * ReportsTable Component
 * Displays a table of cases with pagination
 */

import React from 'react';
import { Badge } from '../common/Badge';
import './ReportsTable.css';

export const ReportsTable = ({ cases, onCaseClick, pagination, onPageChange }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="reports-table">
      {cases.length === 0 ? (
        <div className="reports-table__empty">
          <p>No data available for selected filters</p>
        </div>
      ) : (
        <>
          <div className="reports-table__wrapper">
            <table className="neo-table">
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Case Name</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Category</th>
                  <th>Client Name</th>
                  <th>Assigned To</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((caseItem) => (
                  <tr
                    key={caseItem.caseId}
                    onClick={() => onCaseClick(caseItem.caseId)}
                    className="reports-table__row"
                  >
                    <td>{caseItem.caseId}</td>
                    <td>{caseItem.caseName}</td>
                    <td>{caseItem.title}</td>
                    <td>
                      <Badge status={caseItem.status}>{caseItem.status}</Badge>
                    </td>
                    <td>{caseItem.category}</td>
                    <td>{caseItem.clientName}</td>
                    <td>{caseItem.assignedTo || 'Workbasket'}</td>
                    <td>{formatDate(caseItem.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {pagination && pagination.pages > 1 && (
            <div className="reports-table__pagination">
              <button
                className="neo-button"
                disabled={pagination.page === 1}
                onClick={() => onPageChange(pagination.page - 1)}
              >
                Previous
              </button>
              
              <span className="reports-table__page-info">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </span>
              
              <button
                className="neo-button"
                disabled={pagination.page === pagination.pages}
                onClick={() => onPageChange(pagination.page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
