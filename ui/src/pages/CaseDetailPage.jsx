/**
 * Case Detail Page
 * PR #45: Added view-only mode indicator and audit log display
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Textarea } from '../components/common/Textarea';
import { Input } from '../components/common/Input';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { caseService } from '../services/caseService';
import { formatDateTime } from '../utils/formatters';
import './CaseDetailPage.css';

export const CaseDetailPage = () => {
  const { caseId } = useParams();
  const { user } = useAuth();
  const permissions = usePermissions();
  
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const loadCase = async () => {
    setLoading(true);
    try {
      const response = await caseService.getCaseById(caseId);
      
      if (response.success) {
        setCaseData(response.data);
      }
    } catch (error) {
      console.error('Failed to load case:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    setSubmitting(true);
    try {
      await caseService.addComment(caseId, newComment);
      setNewComment('');
      await loadCase(); // Reload to show new comment
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading case..." />
      </Layout>
    );
  }

  if (!caseData) {
    return (
      <Layout>
        <div className="container">
          <Card>
            <p>Case not found</p>
          </Card>
        </div>
      </Layout>
    );
  }

  // PR #45: Extract access mode information from API response
  const accessMode = caseData.accessMode || {};
  const isViewOnlyMode = accessMode.isViewOnlyMode;

  return (
    <Layout>
      <div className="case-detail">
        <div className="case-detail__header">
          <div>
            <h1>{caseData.case?.caseName || caseData.caseName}</h1>
            <p className="text-secondary">{caseData.case?.category || caseData.category}</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
            {/* PR #45: View-Only Mode Indicator */}
            {isViewOnlyMode && (
              <Badge variant="warning">View-Only Mode</Badge>
            )}
            <Badge status={caseData.case?.status || caseData.status}>
              {caseData.case?.status || caseData.status}
            </Badge>
          </div>
        </div>

        {/* PR #45: View-Only Mode Alert */}
        {isViewOnlyMode && (
          <div className="neo-alert neo-alert--info" style={{ marginBottom: 'var(--spacing-lg)' }}>
            <h3>🔍 Viewing Case in Read-Only Mode</h3>
            <p>
              This case is not assigned to you. You can view all details, add comments, and attach files,
              but you cannot edit case details, change status, or reassign the case.
            </p>
          </div>
        )}

        {/* Lock Status Warning */}
        {caseData.case?.lockStatus?.isLocked && 
         caseData.case.lockStatus.activeUserEmail !== user?.email?.toLowerCase() && (
          <div className="neo-alert neo-alert--warning" style={{ marginBottom: 'var(--spacing-lg)' }}>
            <h3>Case is Currently Locked</h3>
            <p>
              This case is currently being worked on by <strong>{caseData.case.lockStatus.activeUserEmail}</strong> since{' '}
              {formatDateTime(caseData.case.lockStatus.lastActivityAt || caseData.case.lockStatus.lockedAt)}.
            </p>
            <p>You can view the case in read-only mode.</p>
          </div>
        )}

        <div className="case-detail__grid">
          <Card className="case-detail__section">
            <h2 className="neo-section__header">Case Information</h2>
            <div className="case-detail__field">
              <span className="case-detail__label">Case Name:</span>
              <span>{caseData.case?.caseName || caseData.caseName}</span>
            </div>
            <div className="case-detail__field">
              <span className="case-detail__label">Client ID:</span>
              <span>{caseData.case?.clientId || caseData.clientId || 'N/A'}</span>
            </div>
            {caseData.client && (
              <div className="case-detail__field">
                <span className="case-detail__label">Client Name:</span>
                <span>{caseData.client.businessName}</span>
              </div>
            )}
            <div className="case-detail__field">
              <span className="case-detail__label">Category:</span>
              <span>{caseData.case?.category || caseData.category}</span>
            </div>
            <div className="case-detail__field">
              <span className="case-detail__label">Status:</span>
              <Badge status={caseData.case?.status || caseData.status}>
                {caseData.case?.status || caseData.status}
              </Badge>
            </div>
            <div className="case-detail__field">
              <span className="case-detail__label">Assigned To:</span>
              <span>{caseData.case?.assignedTo || 'Unassigned'}</span>
            </div>
            <div className="case-detail__field">
              <span className="case-detail__label">Created:</span>
              <span>{formatDateTime(caseData.case?.createdAt || caseData.createdAt)}</span>
            </div>
            <div className="case-detail__field">
              <span className="case-detail__label">Last Updated:</span>
              <span>{formatDateTime(caseData.case?.updatedAt || caseData.updatedAt)}</span>
            </div>
          </Card>

          {(caseData.case?.description || caseData.description) && (
            <Card className="case-detail__section">
              <h2 className="neo-section__header">Description</h2>
              <p>{caseData.case?.description || caseData.description}</p>
            </Card>
          )}
        </div>

        <Card className="case-detail__section">
          <h2 className="neo-section__header">Comments</h2>
          <div className="case-detail__comments">
            {caseData.comments && caseData.comments.length > 0 ? (
              caseData.comments.map((comment, index) => (
                <div key={index} className="neo-inset" style={{ marginBottom: 'var(--spacing-md)' }}>
                  <div className="case-detail__comment-header">
                    <span className="case-detail__comment-author">{comment.createdBy || 'System'}</span>
                    <span className="text-secondary text-sm">{formatDateTime(comment.createdAt)}</span>
                  </div>
                  <p className="case-detail__comment-text">{comment.text}</p>
                </div>
              ))
            ) : (
              <p className="text-secondary">No comments yet</p>
            )}
          </div>

          {/* PR #45: Always allow comments (in both view-only and assigned modes) */}
          {(accessMode.canComment || permissions.canAddComment(caseData)) && (
            <div className="case-detail__add-comment">
              <Textarea
                label="Add Comment"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Enter your comment..."
                rows={4}
              />
              <Button
                variant="primary"
                onClick={handleAddComment}
                disabled={!newComment.trim() || submitting}
              >
                {submitting ? 'Adding...' : 'Add Comment'}
              </Button>
            </div>
          )}
        </Card>

        {caseData.attachments && caseData.attachments.length > 0 && (
          <Card className="case-detail__section">
            <h2 className="neo-section__header">Attachments</h2>
            <div className="case-detail__attachments">
              {caseData.attachments.map((attachment, index) => (
                <div key={index} className="neo-inset" style={{ marginBottom: 'var(--spacing-sm)' }}>
                  <div className="case-detail__attachment">
                    <span>{attachment.fileName || attachment.filename}</span>
                    <span className="text-secondary text-sm">{attachment.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* PR #45: Display audit log from CaseAudit collection */}
        {caseData.auditLog && caseData.auditLog.length > 0 && (
          <Card className="case-detail__section">
            <h2 className="neo-section__header">Activity Timeline</h2>
            <div className="case-detail__audit">
              {caseData.auditLog.map((entry, index) => (
                <div key={index} className="neo-inset" style={{ marginBottom: 'var(--spacing-sm)' }}>
                  <div className="case-detail__audit-entry">
                    <span className="text-sm">{formatDateTime(entry.timestamp)}</span>
                    <span>{entry.actionType}</span>
                    <span className="text-secondary text-sm">{entry.performedByXID}</span>
                  </div>
                  <p className="text-sm text-secondary" style={{ marginTop: 'var(--spacing-xs)' }}>
                    {entry.description}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Fallback to old audit history if new audit log not available */}
        {(!caseData.auditLog || caseData.auditLog.length === 0) && 
         caseData.history && caseData.history.length > 0 && (
          <Card className="case-detail__section">
            <h2 className="neo-section__header">Audit History</h2>
            <div className="case-detail__audit">
              {caseData.history.map((entry, index) => (
                <div key={index} className="neo-inset" style={{ marginBottom: 'var(--spacing-sm)' }}>
                  <div className="case-detail__audit-entry">
                    <span className="text-sm">{formatDateTime(entry.timestamp)}</span>
                    <span>{entry.actionType}</span>
                    <span className="text-secondary text-sm">{entry.performedBy}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
};
