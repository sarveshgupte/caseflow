/**
 * CaseHistory Component
 * 
 * PR: Comprehensive CaseHistory & Audit Trail
 * Displays chronological audit trail for a case
 * Shows who did what, when, and how
 */

import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Loading } from './Loading';
import { Badge } from './Badge';
import { useAuth } from '../../hooks/useAuth';
import { caseService } from '../../services/caseService';
import { formatDateTime } from '../../utils/formatters';

export const CaseHistory = ({ caseId }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadHistory();
  }, [caseId]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await caseService.getCaseHistory(caseId);
      
      if (response.success) {
        setHistory(response.data.history || []);
      }
    } catch (err) {
      console.error('Failed to load case history:', err);
      setError('Failed to load case history');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'red';
      case 'ADMIN':
        return 'blue';
      case 'SYSTEM':
        return 'gray';
      default:
        return 'green';
    }
  };

  const getActionTypeColor = (actionType) => {
    if (actionType.includes('CREATED')) return 'green';
    if (actionType.includes('ASSIGNED')) return 'blue';
    if (actionType.includes('RESOLVED') || actionType.includes('FILED')) return 'purple';
    if (actionType.includes('PENDED')) return 'yellow';
    if (actionType.includes('VIEWED') || actionType.includes('OPENED') || actionType.includes('EXITED')) return 'gray';
    return 'blue';
  };

  if (loading) {
    return (
      <Card title="Case History" className="mt-6">
        <Loading text="Loading history..." />
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Case History" className="mt-6">
        <p className="text-red-600">{error}</p>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card title="Case History" className="mt-6">
        <p className="text-gray-500">No history entries found.</p>
      </Card>
    );
  }

  return (
    <Card title="Case History" className="mt-6">
      <div className="space-y-4">
        {history.map((entry, index) => (
          <div 
            key={entry.id || index} 
            className="border-l-4 border-gray-300 pl-4 pb-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge color={getActionTypeColor(entry.actionType)}>
                    {entry.actionType.replace(/_/g, ' ')}
                  </Badge>
                  <Badge color={getRoleBadgeColor(entry.actorRole)}>
                    {entry.actorRole}
                  </Badge>
                </div>
                
                <p className="font-medium text-gray-900 mb-1">
                  {entry.actionLabel || entry.description}
                </p>
                
                {entry.actionLabel && entry.actionLabel !== entry.description && (
                  <p className="text-sm text-gray-600 mb-2">
                    {entry.description}
                  </p>
                )}
                
                <div className="text-sm text-gray-500">
                  <span className="font-medium">{entry.actorXID}</span>
                  {entry.actorEmail && entry.actorEmail !== 'SYSTEM' && (
                    <span> ({entry.actorEmail})</span>
                  )}
                  {' • '}
                  <span>{formatDateTime(entry.timestamp)}</span>
                  {user?.role === 'Admin' && entry.ipAddress && (
                    <>
                      {' • '}
                      <span className="text-xs">IP: {entry.ipAddress}</span>
                    </>
                  )}
                </div>
                
                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <details className="mt-2 text-xs text-gray-500">
                    <summary className="cursor-pointer hover:text-gray-700">
                      View Details
                    </summary>
                    <pre className="mt-1 p-2 bg-gray-50 rounded overflow-auto">
                      {JSON.stringify(entry.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
