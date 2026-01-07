/**
 * Create Case Page
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { Textarea } from '../components/common/Textarea';
import { Button } from '../components/common/Button';
import { caseService } from '../services/caseService';
import { CASE_CATEGORIES } from '../utils/constants';
import './CreateCasePage.css';

export const CreateCasePage = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    clientId: '',
    category: '',
    description: '',
  });
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const categoryOptions = [
    { value: CASE_CATEGORIES.CLIENT_NEW, label: 'Client – New' },
    { value: CASE_CATEGORIES.CLIENT_EDIT, label: 'Client – Edit' },
    { value: CASE_CATEGORIES.OTHER, label: 'Other' },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e, forceCreate = false) => {
    e.preventDefault();
    setError('');
    setDuplicateWarning(null);

    if (!formData.category || !formData.description) {
      setError('Category and description are required');
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
              <Input
                label="Client ID"
                name="clientId"
                value={formData.clientId}
                onChange={handleChange}
                placeholder="Enter client ID (optional)"
              />

              <Select
                label="Category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                options={categoryOptions}
                required
              />

              <Textarea
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter case description"
                required
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
