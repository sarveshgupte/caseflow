/**
 * Case Detail Page
 * PR #45: Added view-only mode indicator and audit log display
 * PR: Comprehensive CaseHistory & Audit Trail - Added view tracking and history display
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
import { Modal } from '../components/common/Modal';
import { CaseHistory } from '../components/common/CaseHistory';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { caseService } from '../services/caseService';
import { formatDateTime, formatClientDisplay } from '../utils/formatters';
import './CaseDetailPage.css';

/**
 * Helper function to normalize case data structure
 * Handles both old and new API response formats
 * PR #45: Utility to avoid repeated fallback patterns
 */
const normalizeCase = (data) => {
  return data.case || data;
};

export const CaseDetailPage = () => {
  const { caseId } = useParams();
  const { user } = useAuth();
  const permissions = usePermissions();
  const { showSuccess, showError, showWarning } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileDescription, setFileDescription] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pullingCase, setPullingCase] = useState(false);
  const [movingToGlobal, setMovingToGlobal] = useState(false);
  const fileInputRef = React.useRef(null);

  // State for File action modal
  const [showFileModal, setShowFileModal] = useState(false);
  const [fileComment, setFileComment] = useState('');
  const [filingCase, setFilingCase] = useState(false);

  // State for Pend action modal
  const [showPendModal, setShowPendModal] = useState(false);
  const [pendComment, setPendComment] = useState('');
  const [pendingUntil, setPendingUntil] = useState('');
  const [pendingCase, setPendingCase] = useState(false);

  // State for Resolve action modal
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveComment, setResolveComment] = useState('');
  const [resolvingCase, setResolvingCase] = useState(false);

  // State for Unpend action modal
  const [showUnpendModal, setShowUnpendModal] = useState(false);
  const [unpendComment, setUnpendComment] = useState('');
  const [unpendingCase, setUnpendingCase] = useState(false);

  // Track case view session
  // PR: Comprehensive CaseHistory & Audit Trail
  const [viewTracked, setViewTracked] = useState(false);

  useEffect(() => {
    loadCase();
    
    // Track case opened
    caseService.trackCaseOpen(caseId);
    
    // Cleanup: track case exit on unmount
    return () => {
      caseService.trackCaseExit(caseId);
    };
  }, [caseId]);

  // Track case viewed after successful load (debounced, once per session)
  useEffect(() => {
    if (caseData && !viewTracked) {
      // Delay slightly to ensure page is fully rendered
      const timer = setTimeout(() => {
        caseService.trackCaseView(caseId);
        setViewTracked(true);
      }, 2000); // 2 second debounce
      
      return () => clearTimeout(timer);
    }
  }, [caseData, viewTracked, caseId]);

  // Track exit on beforeunload (best-effort for tab close)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Use sendBeacon for better reliability on page unload
      if (navigator.sendBeacon) {
        const apiBaseUrl = window.location.origin;
        const token = localStorage.getItem('token');
        const url = `${apiBaseUrl}/api/cases/${caseId}/track-exit`;
        
        // Send beacon with credentials
        const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
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

  const handlePullCase = async () => {
    if (!window.confirm('Pull this case? This will assign it to you.')) {
      return;
    }

    setPullingCase(true);
    try {
      const response = await caseService.pullCase(caseId);
      
      if (response.success) {
        showSuccess('Case pulled and assigned to you');
        await loadCase(); // Reload to update UI
      }
    } catch (error) {
      console.error('Failed to pull case:', error);
      // Sanitize error message: only show if it's from server response, otherwise use generic message
      const serverMessage = error.response?.data?.message;
      const errorMessage = serverMessage && typeof serverMessage === 'string' 
        ? serverMessage.substring(0, 200) // Limit length
        : 'Failed to pull case. Please try again.';
      showError(errorMessage);
    } finally {
      setPullingCase(false);
    }
  };

  const handleMoveToGlobal = async () => {
    if (!window.confirm('This will remove the current assignment and move the case to the Workbasket. Continue?')) {
      return;
    }

    setMovingToGlobal(true);
    try {
      const response = await caseService.moveCaseToGlobal(caseId);
      
      if (response.success) {
        showSuccess('Case moved to Workbasket');
        await loadCase(); // Reload to update UI
      }
    } catch (error) {
      console.error('Failed to move case to workbasket:', error);
      // Sanitize error message: only show if it's from server response, otherwise use generic message
      const serverMessage = error.response?.data?.message;
      const errorMessage = serverMessage && typeof serverMessage === 'string'
        ? serverMessage.substring(0, 200) // Limit length
        : 'Failed to move case. Please try again.';
      showError(errorMessage);
    } finally {
      setMovingToGlobal(false);
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

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUploadFile = async () => {
    if (!selectedFile || !fileDescription.trim()) {
      showWarning('Please select a file and provide a description');
      return;
    }

    setUploadingFile(true);
    try {
      await caseService.addAttachment(caseId, selectedFile, fileDescription);
      setSelectedFile(null);
      setFileDescription('');
      // Reset file input using ref
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await loadCase(); // Reload to show new attachment
    } catch (error) {
      console.error('Failed to upload file:', error);
      showError('Failed to upload file. Please try again.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileCase = async () => {
    if (!fileComment.trim()) {
      showWarning('Comment is mandatory for filing a case');
      return;
    }

    setFilingCase(true);
    try {
      const response = await caseService.fileCase(caseId, fileComment);
      
      if (response.success) {
        showSuccess('Case filed successfully');
        setShowFileModal(false);
        setFileComment('');
        await loadCase(); // Reload to update UI
      }
    } catch (error) {
      console.error('Failed to file case:', error);
      const serverMessage = error.response?.data?.message;
      const errorMessage = serverMessage && typeof serverMessage === 'string'
        ? serverMessage.substring(0, 200)
        : 'Failed to file case. Please try again.';
      showError(errorMessage);
    } finally {
      setFilingCase(false);
    }
  };

  const handlePendCase = async () => {
    if (!pendComment.trim()) {
      showWarning('Comment is mandatory for pending a case');
      return;
    }

    if (!pendingUntil) {
      showWarning('Reopen date is mandatory for pending a case');
      return;
    }

    // Validate that reopen date is not in the past
    const selectedDate = new Date(pendingUntil);
    const today = new Date();
    // Normalize both dates to midnight for accurate comparison
    selectedDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      showWarning('Reopen date must be today or in the future');
      return;
    }

    setPendingCase(true);
    try {
      const response = await caseService.pendCase(caseId, pendComment, pendingUntil);
      
      if (response.success) {
        showSuccess('Case pended successfully');
        setShowPendModal(false);
        setPendComment('');
        setPendingUntil('');
        await loadCase(); // Reload to update UI
      }
    } catch (error) {
      console.error('Failed to pend case:', error);
      const serverMessage = error.response?.data?.message;
      const errorMessage = serverMessage && typeof serverMessage === 'string'
        ? serverMessage.substring(0, 200)
        : 'Failed to pend case. Please try again.';
      showError(errorMessage);
    } finally {
      setPendingCase(false);
    }
  };

  const handleResolveCase = async () => {
    if (!resolveComment.trim()) {
      showWarning('Comment is mandatory for resolving a case');
      return;
    }

    setResolvingCase(true);
    try {
      const response = await caseService.resolveCase(caseId, resolveComment);
      
      if (response.success) {
        showSuccess('Case resolved successfully');
        setShowResolveModal(false);
        setResolveComment('');
        await loadCase(); // Reload to update UI
      }
    } catch (error) {
      console.error('Failed to resolve case:', error);
      const serverMessage = error.response?.data?.message;
      const errorMessage = serverMessage && typeof serverMessage === 'string'
        ? serverMessage.substring(0, 200)
        : 'Failed to resolve case. Please try again.';
      showError(errorMessage);
    } finally {
      setResolvingCase(false);
    }
  };

  const handleUnpendCase = async () => {
    if (!unpendComment.trim()) {
      showWarning('Comment is mandatory for unpending a case');
      return;
    }

    setUnpendingCase(true);
    try {
      const response = await caseService.unpendCase(caseId, unpendComment);
      
      if (response.success) {
        showSuccess('Case unpended successfully');
        setShowUnpendModal(false);
        setUnpendComment('');
        await loadCase(); // Reload to update UI
      }
    } catch (error) {
      console.error('Failed to unpend case:', error);
      const serverMessage = error.response?.data?.message;
      const errorMessage = serverMessage && typeof serverMessage === 'string'
        ? serverMessage.substring(0, 200)
        : 'Failed to unpend case. Please try again.';
      showError(errorMessage);
    } finally {
      setUnpendingCase(false);
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
  
  // PR #45: Normalize case data structure
  const caseInfo = normalizeCase(caseData);

  // Determine if user is admin
  const isAdmin = user?.role === 'Admin';

  // Determine button visibility
  // Pull Case button: show only if view-only mode, unassigned, and in GLOBAL queue
  const showPullButton = isViewOnlyMode && 
                          !caseInfo.assignedToXID && 
                          caseInfo.queueType === 'GLOBAL' &&
                          caseInfo.status === 'UNASSIGNED';

  // Move to Workbasket button: show only for admin users AND case is currently assigned
  const showMoveToWorkbasketButton = isAdmin && caseInfo.assignedToXID;

  // Case action buttons (File, Pend, Resolve) - PR: Fix Case Lifecycle
  // Action Visibility Rules:
  // - OPEN: Show File, Pend, Resolve (no Unpend)
  // - PENDING/PENDED: Show ONLY Unpend (no File, Pend, Resolve)
  // - FILED or RESOLVED: Show nothing (terminal states, read-only)
  const canPerformLifecycleActions = caseInfo.status === 'OPEN' && !isViewOnlyMode;
  const canUnpend = (caseInfo.status === 'PENDED' || caseInfo.status === 'PENDING') && !isViewOnlyMode;

  return (
    <Layout>
      <div className="case-detail">
        <div className="case-detail__header">
          <div>
            <h1>{caseInfo.caseName}</h1>
            <p className="text-secondary">{caseInfo.category}</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
            {/* Contextual Action Buttons */}
            {showPullButton && (
              <Button
                variant="primary"
                onClick={handlePullCase}
                disabled={pullingCase}
              >
                {pullingCase ? 'Pulling...' : 'Pull Case'}
              </Button>
            )}
            {showMoveToWorkbasketButton && (
              <Button
                variant="default"
                onClick={handleMoveToGlobal}
                disabled={movingToGlobal}
                style={{ 
                  borderColor: 'var(--warning-color)',
                  color: 'var(--warning-color)'
                }}
              >
                {movingToGlobal ? 'Moving...' : 'Move to Workbasket'}
              </Button>
            )}
            {/* Case Action Buttons: File, Pend, Resolve (for OPEN status only) */}
            {canPerformLifecycleActions && (
              <>
                <Button
                  variant="default"
                  onClick={() => setShowFileModal(true)}
                  style={{ 
                    borderColor: 'var(--text-secondary)',
                    color: 'var(--text-secondary)'
                  }}
                >
                  File
                </Button>
                <Button
                  variant="default"
                  onClick={() => setShowPendModal(true)}
                  style={{ 
                    borderColor: 'var(--warning-color)',
                    color: 'var(--warning-color)'
                  }}
                >
                  Pend
                </Button>
                <Button
                  variant="success"
                  onClick={() => setShowResolveModal(true)}
                >
                  Resolve
                </Button>
              </>
            )}
            {/* Unpend Button (for PENDING/PENDED status only) */}
            {canUnpend && (
              <Button
                variant="primary"
                onClick={() => setShowUnpendModal(true)}
              >
                Unpend
              </Button>
            )}
            {/* PR #45: View-Only Mode Indicator */}
            {isViewOnlyMode && (
              <Badge variant="warning">View-Only Mode</Badge>
            )}
            <Badge status={caseInfo.status}>
              {caseInfo.status}
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
        {caseInfo.lockStatus?.isLocked && 
         caseInfo.lockStatus.activeUserEmail !== user?.email?.toLowerCase() && (
          <div className="neo-alert neo-alert--warning" style={{ marginBottom: 'var(--spacing-lg)' }}>
            <h3>Case is Currently Locked</h3>
            <p>
              This case is currently being worked on by another user since{' '}
              {formatDateTime(caseInfo.lockStatus.lastActivityAt || caseInfo.lockStatus.lockedAt)}.
            </p>
            <p>You can view the case in read-only mode.</p>
          </div>
        )}

        <div className="case-detail__grid">
          <Card className="case-detail__section">
            <h2 className="neo-section__header">Case Information</h2>
            <div className="case-detail__field">
              <span className="case-detail__label">Case Name:</span>
              <span>{caseInfo.caseName}</span>
            </div>
            {caseData.client && (
              <div className="case-detail__field">
                <span className="case-detail__label">Client:</span>
                <span>{formatClientDisplay(caseData.client, true)}</span>
              </div>
            )}
            <div className="case-detail__field">
              <span className="case-detail__label">Category:</span>
              <span>{caseInfo.category}</span>
            </div>
            <div className="case-detail__field">
              <span className="case-detail__label">Status:</span>
              <Badge status={caseInfo.status}>
                {caseInfo.status}
              </Badge>
            </div>
            <div className="case-detail__field">
              <span className="case-detail__label">Location:</span>
              <span>{caseInfo.assignedToXID ? 'My Worklist' : 'Workbasket'}</span>
            </div>
            <div className="case-detail__field">
              <span className="case-detail__label">Created:</span>
              <span>{formatDateTime(caseInfo.createdAt)}</span>
            </div>
            <div className="case-detail__field">
              <span className="case-detail__label">Last Updated:</span>
              <span>{formatDateTime(caseInfo.updatedAt)}</span>
            </div>
          </Card>

          {caseInfo.description && (
            <Card className="case-detail__section">
              <h2 className="neo-section__header">Description</h2>
              <p>{caseInfo.description}</p>
            </Card>
          )}
        </div>

        {/* Attachments Section - Placed above Comments */}
        <Card className="case-detail__section">
          <h2 className="neo-section__header">Attachments</h2>
          <div className="case-detail__attachments">
            {caseData.attachments && caseData.attachments.length > 0 ? (
              caseData.attachments.map((attachment, index) => (
                <div key={index} className="neo-inset" style={{ marginBottom: 'var(--spacing-md)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                    <div style={{ fontWeight: '500', fontSize: '1rem' }}>
                      📄 {attachment.fileName || attachment.filename}
                    </div>
                    <div className="text-secondary text-sm">
                      {attachment.visibility === 'external' ? (
                        <>
                          <strong>External Email</strong>
                          <br />
                          From: {attachment.createdBy}
                        </>
                      ) : (
                        <>
                          Attached by {attachment.createdByName && attachment.createdByXID
                            ? `${attachment.createdByName} (${attachment.createdByXID})`
                            : 'System (Unknown)'}
                        </>
                      )}
                    </div>
                    <div className="text-secondary text-sm">
                      {attachment.visibility === 'external' ? 'Received on: ' : 'Attached on: '}
                      {formatDateTime(attachment.createdAt)}
                    </div>
                    {attachment.description && (
                      <div className="text-secondary text-sm" style={{ marginTop: 'var(--spacing-xs)' }}>
                        {attachment.description}
                      </div>
                    )}
                    {/* View and Download buttons */}
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => caseService.viewAttachment(caseId, attachment._id)}
                      >
                        View
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => caseService.downloadAttachment(caseId, attachment._id, attachment.fileName || attachment.filename)}
                      >
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-secondary">No attachments yet</p>
            )}
          </div>

          {/* File upload UI - Always visible when user can attach */}
          {(accessMode.canAttach || permissions.canAddAttachment(caseData)) && (
            <div className="case-detail__add-attachment" style={{ marginTop: 'var(--spacing-lg)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                <div className="neo-form-group">
                  <label className="neo-form-label">Attach File</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="neo-input"
                    onChange={handleFileSelect}
                    disabled={uploadingFile}
                  />
                </div>
                {selectedFile && (
                  <div className="text-sm text-secondary">
                    Selected: {selectedFile.name}
                  </div>
                )}
                <Textarea
                  label="File Description"
                  value={fileDescription}
                  onChange={(e) => setFileDescription(e.target.value)}
                  placeholder="Describe this attachment..."
                  rows={3}
                  disabled={uploadingFile}
                />
                <Button
                  variant="primary"
                  onClick={handleUploadFile}
                  disabled={!selectedFile || !fileDescription.trim() || uploadingFile}
                >
                  {uploadingFile ? 'Uploading...' : 'Upload File'}
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card className="case-detail__section">
          <h2 className="neo-section__header">Comments</h2>
          <div className="case-detail__comments">
            {caseData.comments && caseData.comments.length > 0 ? (
              caseData.comments.map((comment, index) => (
                <div key={index} className="neo-inset" style={{ marginBottom: 'var(--spacing-md)' }}>
                  <div className="case-detail__comment-header">
                    <span className="case-detail__comment-author">
                      {comment.createdByName && comment.createdByXID 
                        ? `${comment.createdByName} (${comment.createdByXID})`
                        : 'System (Unknown)'}
                    </span>
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
                    <span className="text-secondary text-sm">
                      {entry.performedByName && entry.performedByXID
                        ? `${entry.performedByName} (${entry.performedByXID})`
                        : 'System (Unknown)'}
                    </span>
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
                    <span className="text-secondary text-sm">
                      {entry.performedByXID 
                        ? `System (${entry.performedByXID})`
                        : 'System (Unknown)'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* File Case Modal */}
        <Modal
          isOpen={showFileModal}
          onClose={() => {
            setShowFileModal(false);
            setFileComment('');
          }}
          title="File Case"
          actions={
            <>
              <Button
                variant="default"
                onClick={() => {
                  setShowFileModal(false);
                  setFileComment('');
                }}
                disabled={filingCase}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleFileCase}
                disabled={!fileComment.trim() || filingCase}
              >
                {filingCase ? 'Filing...' : 'File Case'}
              </Button>
            </>
          }
        >
          <div style={{ padding: 'var(--spacing-md)' }}>
            <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
              Filing a case indicates it was opened in error, is a duplicate, or was incorrectly created.
              The case will become read-only after filing.
            </p>
            <Textarea
              label="Comment (Required)"
              value={fileComment}
              onChange={(e) => setFileComment(e.target.value)}
              placeholder="Explain why this case is being filed..."
              rows={4}
              required
              disabled={filingCase}
            />
          </div>
        </Modal>

        {/* Pend Case Modal */}
        <Modal
          isOpen={showPendModal}
          onClose={() => {
            setShowPendModal(false);
            setPendComment('');
            setPendingUntil('');
          }}
          title="Pend Case"
          actions={
            <>
              <Button
                variant="default"
                onClick={() => {
                  setShowPendModal(false);
                  setPendComment('');
                  setPendingUntil('');
                }}
                disabled={pendingCase}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handlePendCase}
                disabled={!pendComment.trim() || !pendingUntil || pendingCase}
              >
                {pendingCase ? 'Pending...' : 'Pend Case'}
              </Button>
            </>
          }
        >
          <div style={{ padding: 'var(--spacing-md)' }}>
            <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
              Pending a case temporarily pauses it until a specified date.
              The case will not appear in your worklist until the reopen date.
            </p>
            <Textarea
              label="Comment (Required)"
              value={pendComment}
              onChange={(e) => setPendComment(e.target.value)}
              placeholder="Explain why this case is being pended..."
              rows={4}
              required
              disabled={pendingCase}
            />
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              <Input
                type="date"
                label="Reopen Date (Required)"
                value={pendingUntil}
                onChange={(e) => setPendingUntil(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                disabled={pendingCase}
              />
            </div>
          </div>
        </Modal>

        {/* Resolve Case Modal */}
        <Modal
          isOpen={showResolveModal}
          onClose={() => {
            setShowResolveModal(false);
            setResolveComment('');
          }}
          title="Resolve Case"
          actions={
            <>
              <Button
                variant="default"
                onClick={() => {
                  setShowResolveModal(false);
                  setResolveComment('');
                }}
                disabled={resolvingCase}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                onClick={handleResolveCase}
                disabled={!resolveComment.trim() || resolvingCase}
              >
                {resolvingCase ? 'Resolving...' : 'Resolve Case'}
              </Button>
            </>
          }
        >
          <div style={{ padding: 'var(--spacing-md)' }}>
            <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
              Resolving a case marks it as fully completed with no further action required.
              The case will become read-only after resolution.
            </p>
            <Textarea
              label="Comment (Required)"
              value={resolveComment}
              onChange={(e) => setResolveComment(e.target.value)}
              placeholder="Describe how this case was resolved..."
              rows={4}
              required
              disabled={resolvingCase}
            />
          </div>
        </Modal>

        {/* Unpend Case Modal */}
        <Modal
          isOpen={showUnpendModal}
          onClose={() => {
            setShowUnpendModal(false);
            setUnpendComment('');
          }}
          title="Unpend Case"
          actions={
            <>
              <Button
                variant="default"
                onClick={() => {
                  setShowUnpendModal(false);
                  setUnpendComment('');
                }}
                disabled={unpendingCase}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUnpendCase}
                disabled={!unpendComment.trim() || unpendingCase}
              >
                {unpendingCase ? 'Unpending...' : 'Unpend Case'}
              </Button>
            </>
          }
        >
          <div style={{ padding: 'var(--spacing-md)' }}>
            <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
              Unpending a case will move it back to OPEN status and return it to your worklist.
              Use this when you no longer need to wait for external input.
            </p>
            <Textarea
              label="Comment (Required)"
              value={unpendComment}
              onChange={(e) => setUnpendComment(e.target.value)}
              placeholder="Explain why this case is being unpended..."
              rows={4}
              required
              disabled={unpendingCase}
            />
          </div>
        </Modal>
        
        {/* Case History - PR: Comprehensive CaseHistory & Audit Trail */}
        {user && user.role !== 'SUPER_ADMIN' && (
          <CaseHistory caseId={caseId} />
        )}
      </div>
    </Layout>
  );
};
