/**
 * Admin Page
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { Modal } from '../components/common/Modal';
import { Loading } from '../components/common/Loading';
import { adminService } from '../services/adminService';
import { categoryService } from '../services/categoryService';
import { useToast } from '../hooks/useToast';
import './AdminPage.css';

export const AdminPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [pendingCases, setPendingCases] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Create user form state (PR 32: xID is auto-generated, not user-provided)
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'Employee',
  });
  
  // Category form state
  const [categoryForm, setCategoryForm] = useState({
    name: '',
  });
  
  // Subcategory form state
  const [subcategoryForm, setSubcategoryForm] = useState({
    name: '',
  });

  useEffect(() => {
    loadAdminData();
  }, [activeTab]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'approvals') {
        const response = await adminService.getPendingApprovals();
        if (response.success) {
          setPendingCases(response.data || []);
        }
      } else if (activeTab === 'users') {
        const response = await adminService.getUsers();
        if (response.success) {
          setUsers(response.data || []);
        }
      } else if (activeTab === 'categories') {
        const response = await categoryService.getCategories(false); // Get all categories including inactive
        if (response.success) {
          setCategories(response.data || []);
        }
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCaseClick = (caseId) => {
    navigate(`/cases/${caseId}`);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    // PR 32: Only name and email are required (xID is auto-generated)
    if (!newUser.name || !newUser.email) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setCreatingUser(true);

    try {
      const response = await adminService.createUser(newUser);
      
      if (response.success) {
        showToast(`User created successfully! xID: ${response.data?.xID}. Invite email sent.`, 'success');
        setShowCreateModal(false);
        setNewUser({ name: '', email: '', role: 'Employee' });
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to create user', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create user', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleUserStatus = async (user) => {
    const newStatus = !user.isActive;
    const action = newStatus ? 'activate' : 'deactivate';

    try {
      const response = await adminService.updateUserStatus(user.xID, newStatus);
      
      if (response.success) {
        showToast(`User ${action}d successfully`, 'success');
        loadAdminData();
      } else {
        showToast(response.message || `Failed to ${action} user`, 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || `Failed to ${action} user`, 'error');
    }
  };

  const handleResendSetupEmail = async (xID) => {
    try {
      const response = await adminService.resendSetupEmail(xID);
      
      if (response.success) {
        showToast('Password setup email sent successfully', 'success');
      } else {
        showToast(response.message || 'Failed to send email', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to send email', 'error');
    }
  };

  const handleUnlockAccount = async (xID) => {
    try {
      const response = await adminService.unlockAccount(xID);
      
      if (response.success) {
        showToast('Account unlocked successfully', 'success');
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to unlock account', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to unlock account', 'error');
    }
  };
  
  // Category Management Handlers
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    
    if (!categoryForm.name || !categoryForm.name.trim()) {
      showToast('Please enter a category name', 'error');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await categoryService.createCategory(categoryForm.name.trim());
      
      if (response.success) {
        showToast('Category created successfully', 'success');
        setShowCategoryModal(false);
        setCategoryForm({ name: '' });
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to create category', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create category', 'error');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleToggleCategoryStatus = async (category) => {
    const newStatus = !category.isActive;
    const action = newStatus ? 'enable' : 'disable';
    
    try {
      const response = await categoryService.toggleCategoryStatus(category._id, newStatus);
      
      if (response.success) {
        showToast(`Category ${action}d successfully`, 'success');
        loadAdminData();
      } else {
        showToast(response.message || `Failed to ${action} category`, 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || `Failed to ${action} category`, 'error');
    }
  };
  
  const handleAddSubcategory = async (e) => {
    e.preventDefault();
    
    if (!subcategoryForm.name || !subcategoryForm.name.trim()) {
      showToast('Please enter a subcategory name', 'error');
      return;
    }
    
    if (!selectedCategory) {
      showToast('No category selected', 'error');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await categoryService.addSubcategory(
        selectedCategory._id,
        subcategoryForm.name.trim()
      );
      
      if (response.success) {
        showToast('Subcategory added successfully', 'success');
        setShowSubcategoryModal(false);
        setSubcategoryForm({ name: '' });
        setSelectedCategory(null);
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to add subcategory', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to add subcategory', 'error');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleToggleSubcategoryStatus = async (category, subcategory) => {
    const newStatus = !subcategory.isActive;
    const action = newStatus ? 'enable' : 'disable';
    
    try {
      const response = await categoryService.toggleSubcategoryStatus(
        category._id,
        subcategory.id,
        newStatus
      );
      
      if (response.success) {
        showToast(`Subcategory ${action}d successfully`, 'success');
        loadAdminData();
      } else {
        showToast(response.message || `Failed to ${action} subcategory`, 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || `Failed to ${action} subcategory`, 'error');
    }
  };

  const handleDeleteCategory = async (category) => {
    if (!confirm(`Are you sure you want to delete category "${category.name}"? This is a soft delete - the category will be hidden from dropdowns but historical cases will remain valid.`)) {
      return;
    }
    
    try {
      const response = await categoryService.deleteCategory(category._id);
      
      if (response.success) {
        showToast('Category deleted successfully', 'success');
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to delete category', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete category', 'error');
    }
  };

  const handleDeleteSubcategory = async (category, subcategory) => {
    if (!confirm(`Are you sure you want to delete subcategory "${subcategory.name}"? This is a soft delete - the subcategory will be hidden from dropdowns but historical cases will remain valid.`)) {
      return;
    }
    
    try {
      const response = await categoryService.deleteSubcategory(category._id, subcategory.id);
      
      if (response.success) {
        showToast('Subcategory deleted successfully', 'success');
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to delete subcategory', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete subcategory', 'error');
    }
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading admin panel..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="admin">
        <div className="admin__header">
          <h1>Admin Panel</h1>
          <p className="text-secondary">Manage users and approvals</p>
        </div>

        <div className="admin__tabs">
          <Button
            variant={activeTab === 'users' ? 'primary' : 'default'}
            onClick={() => setActiveTab('users')}
          >
            User Management ({users.length})
          </Button>
          <Button
            variant={activeTab === 'categories' ? 'primary' : 'default'}
            onClick={() => setActiveTab('categories')}
          >
            Categories ({categories.length})
          </Button>
          <Button
            variant={activeTab === 'approvals' ? 'primary' : 'default'}
            onClick={() => setActiveTab('approvals')}
          >
            Pending Approvals ({pendingCases.length})
          </Button>
          <Button
            variant={activeTab === 'reports' ? 'primary' : 'default'}
            onClick={() => navigate('/admin/reports')}
          >
            Reports & MIS
          </Button>
        </div>

        {activeTab === 'users' && (
          <Card>
            <div className="admin__section-header">
              <h2 className="neo-section__header">User Management</h2>
              <Button
                variant="primary"
                onClick={() => setShowCreateModal(true)}
              >
                + Create User
              </Button>
            </div>
            
            {users.length === 0 ? (
              <div className="admin__empty">
                <p className="text-secondary">No users found</p>
              </div>
            ) : (
              <table className="neo-table">
                <thead>
                  <tr>
                    <th>xID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Password Set</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.xID}>
                      <td>{user.xID}</td>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        <Badge status={user.role === 'Admin' ? 'InProgress' : 'Pending'}>
                          {user.role}
                        </Badge>
                      </td>
                      <td>
                        <Badge status={user.isActive ? 'Approved' : 'Rejected'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td>
                        <Badge status={user.passwordSet ? 'Approved' : 'Pending'}>
                          {user.passwordSet ? 'Yes' : 'No'}
                        </Badge>
                      </td>
                      <td className="admin__actions">
                        <Button
                          size="small"
                          variant={user.isActive ? 'danger' : 'success'}
                          onClick={() => handleToggleUserStatus(user)}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        {!user.passwordSet && (
                          <Button
                            size="small"
                            variant="default"
                            onClick={() => handleResendSetupEmail(user.xID)}
                          >
                            Resend Email
                          </Button>
                        )}
                        {user.lockUntil && new Date(user.lockUntil) > new Date() && (
                          <Button
                            size="small"
                            variant="warning"
                            onClick={() => handleUnlockAccount(user.xID)}
                          >
                            Unlock
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}

        {activeTab === 'categories' && (
          <Card>
            <div className="admin__section-header">
              <h2 className="neo-section__header">Category Management</h2>
              <Button
                variant="primary"
                onClick={() => setShowCategoryModal(true)}
              >
                + Create Category
              </Button>
            </div>
            
            {categories.length === 0 ? (
              <div className="admin__empty">
                <p className="text-secondary">No categories found</p>
              </div>
            ) : (
              <div className="categories-list">
                {categories.map((category) => (
                  <Card key={category._id} className="category-card">
                    <div className="category-header">
                      <div>
                        <h3>{category.name}</h3>
                        <Badge status={category.isActive ? 'Approved' : 'Rejected'}>
                          {category.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="category-actions">
                        <Button
                          size="small"
                          variant="default"
                          onClick={() => {
                            setSelectedCategory(category);
                            setShowSubcategoryModal(true);
                          }}
                        >
                          + Add Subcategory
                        </Button>
                        <Button
                          size="small"
                          variant={category.isActive ? 'danger' : 'success'}
                          onClick={() => handleToggleCategoryStatus(category)}
                        >
                          {category.isActive ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="small"
                          variant="danger"
                          onClick={() => handleDeleteCategory(category)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    
                    {category.subcategories && category.subcategories.length > 0 && (
                      <div className="subcategories-list">
                        <h4>Subcategories:</h4>
                        <table className="neo-table">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {category.subcategories.map((sub) => (
                              <tr key={sub.id}>
                                <td>{sub.name}</td>
                                <td>
                                  <Badge status={sub.isActive ? 'Approved' : 'Rejected'}>
                                    {sub.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                </td>
                                <td>
                                  <Button
                                    size="small"
                                    variant={sub.isActive ? 'danger' : 'success'}
                                    onClick={() => handleToggleSubcategoryStatus(category, sub)}
                                  >
                                    {sub.isActive ? 'Disable' : 'Enable'}
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="danger"
                                    onClick={() => handleDeleteSubcategory(category, sub)}
                                  >
                                    Delete
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === 'approvals' && (
          <Card>
            <h2 className="neo-section__header">Pending Client Approvals</h2>
            
            {pendingCases.length === 0 ? (
              <div className="admin__empty">
                <p className="text-secondary">No pending approvals</p>
              </div>
            ) : (
              <table className="neo-table">
                <thead>
                  <tr>
                    <th>Case Name</th>
                    <th>Category</th>
                    <th>Client ID</th>
                    <th>Created</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingCases.map((caseItem) => (
                    <tr key={caseItem._id} onClick={() => handleCaseClick(caseItem.caseName)}>
                      <td>{caseItem.caseName}</td>
                      <td>{caseItem.category}</td>
                      <td>{caseItem.clientId || 'N/A'}</td>
                      <td>{new Date(caseItem.createdAt).toLocaleDateString()}</td>
                      <td>
                        <Badge status={caseItem.status}>{caseItem.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New User"
      >
        <form onSubmit={handleCreateUser} className="admin__create-form">
          <div className="neo-form-group">
            <label className="neo-label">xID (Auto-Generated)</label>
            <div className="neo-info-text">
              Employee ID will be automatically generated (e.g., X000001)
            </div>
          </div>

          <Input
            label="Name"
            type="text"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            placeholder="John Doe"
            required
          />

          <Input
            label="Email"
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            placeholder="john.doe@company.com"
            required
          />

          <Select
            label="Role"
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            options={[
              { value: 'Employee', label: 'Employee' },
              { value: 'Admin', label: 'Admin' },
            ]}
          />

          <div className="admin__form-actions">
            <Button
              type="button"
              variant="default"
              onClick={() => setShowCreateModal(false)}
              disabled={creatingUser}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={creatingUser}
            >
              {creatingUser ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </Modal>
      
      {/* Create Category Modal */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setCategoryForm({ name: '' });
        }}
        title="Create New Category"
      >
        <form onSubmit={handleCreateCategory} className="admin__create-form">
          <Input
            label="Category Name"
            name="name"
            value={categoryForm.name}
            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
            placeholder="Enter category name"
            required
          />

          <div className="neo-form-actions">
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setShowCategoryModal(false);
                setCategoryForm({ name: '' });
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>
      
      {/* Add Subcategory Modal */}
      <Modal
        isOpen={showSubcategoryModal}
        onClose={() => {
          setShowSubcategoryModal(false);
          setSubcategoryForm({ name: '' });
          setSelectedCategory(null);
        }}
        title={`Add Subcategory to ${selectedCategory?.name || ''}`}
      >
        <form onSubmit={handleAddSubcategory} className="admin__create-form">
          <Input
            label="Subcategory Name"
            name="name"
            value={subcategoryForm.name}
            onChange={(e) => setSubcategoryForm({ ...subcategoryForm, name: e.target.value })}
            placeholder="Enter subcategory name"
            required
          />

          <div className="neo-form-actions">
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setShowSubcategoryModal(false);
                setSubcategoryForm({ name: '' });
                setSelectedCategory(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Adding...' : 'Add Subcategory'}
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};
