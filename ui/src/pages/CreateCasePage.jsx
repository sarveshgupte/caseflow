/**
 * Create Case Page
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { Textarea } from '../components/common/Textarea';
import { Button } from '../components/common/Button';
import { caseService } from '../services/caseService';
import { CASE_CATEGORIES, DEFAULT_CLIENT_ID, API_BASE_URL } from '../utils/constants';
import './CreateCasePage.css';

export const CreateCasePage = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    clientId: DEFAULT_CLIENT_ID, // Default to system client
    caseCategory: '',
    caseSubCategory: '',
    title: '', // Optional field
    description: '',
  });
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch clients for dropdown
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/client-approval/clients`);
        const data = await response.json();
        if (data.success) {
          setClients(data.data || []);
        }
      } catch (err) {
        console.error('Error fetching clients:', err);
      } finally {
        setLoadingClients(false);
      }
    };
    fetchClients();
  }, []);

  const categoryOptions = [
    { value: '', label: 'Select Category' },
    { value: CASE_CATEGORIES.CLIENT_NEW, label: 'Client - New' },
    { value: CASE_CATEGORIES.CLIENT_EDIT, label: 'Client - Edit' },
    { value: CASE_CATEGORIES.CLIENT_DELETE, label: 'Client - Delete' },
    { value: CASE_CATEGORIES.SALES, label: 'Sales' },
    { value: CASE_CATEGORIES.ACCOUNTING, label: 'Accounting' },
    { value: CASE_CATEGORIES.EXPENSES, label: 'Expenses' },
    { value: CASE_CATEGORIES.PAYROLL, label: 'Payroll' },
    { value: CASE_CATEGORIES.HR, label: 'HR' },
    { value: CASE_CATEGORIES.COMPLIANCE, label: 'Compliance' },
    { value: CASE_CATEGORIES.CORE_BUSINESS, label: 'Core Business' },
    { value: CASE_CATEGORIES.MANAGEMENT_REVIEW, label: 'Management Review' },
    { value: CASE_CATEGORIES.INTERNAL, label: 'Internal' },
    { value: CASE_CATEGORIES.OTHER, label: 'Other' },
  ];

  const clientOptions = [
    { value: DEFAULT_CLIENT_ID, label: 'Organization (Default)' },
    ...clients.map(client => ({
      value: client.clientId,
      label: `${client.businessName} (${client.clientId})`,
    })),
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e, forceCreate = false) => {
    e.preventDefault();
    setError('');
    setDuplicateWarning(null);

    if (!formData.caseCategory) {
      setError('Case category is required');
      return;
    }

    setSubmitting(true);

    try {
      const response = await caseService.createCase(formData, forceCreate);
      
      if (response.success) {
        navigate(`/cases/${response.data.caseName}`);
      }
    } catch (err) {
      if (err.response?.status === 409) {
        // Duplicate client warning
        setDuplicateWarning(err.response.data);
      } else {
        setError(err.response?.data?.message || 'Failed to create case');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForceCreate = (e) => {
    handleSubmit(e, true);
  };

  const handleCancelDuplicate = () => {
    setDuplicateWarning(null);
  };

  return (
    <Layout>
      <div className="create-case">
        <div className="create-case__header">
          <h1>Create New Case</h1>
          <p className="text-secondary">Create a new case in the system</p>
        </div>

        <Card>
          {duplicateWarning ? (
            <div className="create-case__duplicate-warning">
              <div className="neo-alert neo-alert--warning">
                <h3>Duplicate Client Detected</h3>
                <p>{duplicateWarning.message}</p>
                
                {duplicateWarning.matchedFields && (
                  <div className="create-case__matched-fields">
                    <p><strong>Matched Fields:</strong></p>
                    <ul>
                      {duplicateWarning.matchedFields.map((field, index) => (
                        <li key={index}>{field}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <p className="mt-md">
                  Do you want to continue creating this case?
                </p>
              </div>

              <div className="create-case__duplicate-actions">
                <Button onClick={handleCancelDuplicate}>
                  Cancel
                </Button>
                <Button variant="warning" onClick={handleForceCreate} disabled={submitting}>
                  {submitting ? 'Creating...' : 'Continue Anyway'}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <Select
                label="Client"
                name="clientId"
                value={formData.clientId}
                onChange={handleChange}
                options={clientOptions}
                required
                disabled={loadingClients}
              />

              <Select
                label="Case Category"
                name="caseCategory"
                value={formData.caseCategory}
                onChange={handleChange}
                options={categoryOptions}
                required
              />

              <Input
                label="Case Sub-Category (Optional)"
                name="caseSubCategory"
                value={formData.caseSubCategory}
                onChange={handleChange}
                placeholder="Enter sub-category if needed"
              />

              <Input
                label="Title (Optional)"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Brief title for the case"
              />

              <Textarea
                label="Description (Optional)"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter detailed case description (optional)"
                rows={6}
              />

              {error && (
                <div className="neo-alert neo-alert--danger">
                  {error}
                </div>
              )}

              <div className="create-case__actions">
                <Button type="button" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Case'}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </Layout>
  );
};
