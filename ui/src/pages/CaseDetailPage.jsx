/**
 * Case Detail Page
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

  return (
    <Layout>
      <div className="case-detail">
        <div className="case-detail__header">
          <div>
            <h1>{caseData.caseName}</h1>
            <p className="text-secondary">{caseData.category}</p>
          </div>
          <Badge status={caseData.status}>{caseData.status}</Badge>
        </div>

        <div className="case-detail__grid">
          <Card className="case-detail__section">
            <h2 className="neo-section__header">Case Information</h2>
            <div className="case-detail__field">
              <span className="case-detail__label">Case Name:</span>
              <span>{caseData.caseName}</span>
            </div>
            <div className="case-detail__field">
              <span className="case-detail__label">Client ID:</span>
              <span>{caseData.clientId || 'N/A'}</span>
            </div>
            <div className="case-detail__field">
              <span className="case-detail__label">Category:</span>
              <span>{caseData.category}</span>
            </div>
            <div className="case-detail__field">
              <span className="case-detail__label">Status:</span>
              <Badge status={caseData.status}>{caseData.status}</Badge>
            </div>
            <div className="case-detail__field">
              <span className="case-detail__label">Created:</span>
              <span>{formatDateTime(caseData.createdAt)}</span>
            </div>
            <div className="case-detail__field">
              <span className="case-detail__label">Last Updated:</span>
              <span>{formatDateTime(caseData.updatedAt)}</span>
            </div>
          </Card>

          {caseData.description && (
            <Card className="case-detail__section">
              <h2 className="neo-section__header">Description</h2>
              <p>{caseData.description}</p>
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

          {permissions.canAddComment(caseData) && (
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
                    <span>{attachment.filename}</span>
                    <span className="text-secondary text-sm">{attachment.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {caseData.auditHistory && caseData.auditHistory.length > 0 && (
          <Card className="case-detail__section">
            <h2 className="neo-section__header">Audit History</h2>
            <div className="case-detail__audit">
              {caseData.auditHistory.map((entry, index) => (
                <div key={index} className="neo-inset" style={{ marginBottom: 'var(--spacing-sm)' }}>
                  <div className="case-detail__audit-entry">
                    <span className="text-sm">{formatDateTime(entry.timestamp)}</span>
                    <span>{entry.action}</span>
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
