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
import { categoryService } from '../services/categoryService';
import { DEFAULT_CLIENT_ID, API_BASE_URL } from '../utils/constants';
import './CreateCasePage.css';

export const CreateCasePage = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    clientId: DEFAULT_CLIENT_ID, // Default to system client
    categoryId: '',
    subcategoryId: '',
    title: '', // MANDATORY
    description: '', // MANDATORY
    slaDueDate: '', // MANDATORY
  });
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Fetch categories for dropdown
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await categoryService.getCategories(true); // Get only active categories
        if (response.success) {
          setCategories(response.data || []);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

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
  
  // Update subcategories when category changes
  useEffect(() => {
    if (formData.categoryId) {
      const selectedCategory = categories.find(cat => cat._id === formData.categoryId);
      if (selectedCategory) {
        // Filter only active subcategories
        const activeSubs = (selectedCategory.subcategories || []).filter(sub => sub.isActive);
        setSubcategories(activeSubs);
      } else {
        setSubcategories([]);
      }
      // Reset subcategory when category changes
      setFormData(prev => ({ ...prev, subcategoryId: '' }));
    } else {
      setSubcategories([]);
    }
  }, [formData.categoryId, categories]);

  const categoryOptions = [
    { value: '', label: 'Select Category *' },
    ...categories.map(cat => ({
      value: cat._id,
      label: cat.name,
    })),
  ];
  
  const subcategoryOptions = [
    { value: '', label: 'Select Subcategory *' },
    ...subcategories.map(sub => ({
      value: sub.id,
      label: sub.name,
    })),
  ];

  const clientOptions = [
    { value: DEFAULT_CLIENT_ID, label: 'Organization (Default)' },
    ...clients.map(client => ({
      value: client.clientId,
      label: `${client.businessName} (${client.clientId})`,
    })),
  ];

  const validateField = (name, value) => {
    let error = '';
    
    switch (name) {
      case 'title':
        if (!value || !value.trim()) {
          error = 'Title is required';
        }
        break;
      case 'description':
        if (!value || !value.trim()) {
          error = 'Description is required';
        }
        break;
      case 'categoryId':
        if (!value) {
          error = 'Category is required';
        }
        break;
      case 'subcategoryId':
        if (!value) {
          error = 'Subcategory is required';
        }
        break;
      case 'slaDueDate':
        if (!value) {
          error = 'SLA Due Date is required';
        } else {
          // Parse the datetime-local value and compare with current time
          const selectedDate = new Date(value);
          const now = new Date();
          if (selectedDate <= now) {
            error = 'SLA Due Date must be in the future';
          }
        }
        break;
      default:
        break;
    }
    
    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Validate field on change
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  };
  
  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    
    // Validate field on blur
    const error = validateField(name, formData[name]);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    newErrors.title = validateField('title', formData.title);
    newErrors.description = validateField('description', formData.description);
    newErrors.categoryId = validateField('categoryId', formData.categoryId);
    newErrors.subcategoryId = validateField('subcategoryId', formData.subcategoryId);
    newErrors.slaDueDate = validateField('slaDueDate', formData.slaDueDate);
    
    setErrors(newErrors);
    setTouched({
      title: true,
      description: true,
      categoryId: true,
      subcategoryId: true,
      slaDueDate: true,
    });
    
    return !Object.values(newErrors).some(error => error);
  };

  const handleSubmit = async (e, forceCreate = false) => {
    e.preventDefault();
    setDuplicateWarning(null);

    if (!validateForm()) {
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
        const errorMsg = err.response?.data?.message || 'Failed to create case';
        setErrors(prev => ({ ...prev, submit: errorMsg }));
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
          <p className="text-secondary">All fields marked with * are required</p>
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
                label="Category *"
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                onBlur={handleBlur}
                options={categoryOptions}
                required
                disabled={loadingCategories}
                error={touched.categoryId && errors.categoryId}
              />

              <Select
                label="Subcategory *"
                name="subcategoryId"
                value={formData.subcategoryId}
                onChange={handleChange}
                onBlur={handleBlur}
                options={subcategoryOptions}
                required
                disabled={!formData.categoryId || subcategories.length === 0}
                error={touched.subcategoryId && errors.subcategoryId}
              />

              <Input
                label="Title *"
                name="title"
                value={formData.title}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Enter case title"
                required
                error={touched.title && errors.title}
              />

              <Textarea
                label="Description *"
                name="description"
                value={formData.description}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Provide detailed case description"
                rows={6}
                required
                error={touched.description && errors.description}
              />

              <Input
                label="SLA Due Date *"
                name="slaDueDate"
                type="datetime-local"
                value={formData.slaDueDate}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                error={touched.slaDueDate && errors.slaDueDate}
              />

              {errors.submit && (
                <div className="neo-alert neo-alert--danger">
                  {errors.submit}
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
