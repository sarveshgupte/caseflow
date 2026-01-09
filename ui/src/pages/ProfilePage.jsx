/**
 * Profile Page
 */

import React, { useState, useEffect } from 'react';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/authService';
import { formatDate } from '../utils/formatters';
import './ProfilePage.css';

export const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [formData, setFormData] = useState({
    dateOfBirth: '',
    gender: '',
    phone: '',
    address: '',
    panMasked: '',
    aadhaarMasked: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await authService.getProfile();
      
      if (response.success) {
        setProfileData(response.data);
        setFormData({
          dateOfBirth: response.data.dateOfBirth || '',
          gender: response.data.gender || '',
          phone: response.data.phone || '',
          address: response.data.address || '',
          panMasked: response.data.panMasked || '',
          aadhaarMasked: response.data.aadhaarMasked || '',
        });
      }
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const response = await authService.updateProfile(formData);
      
      if (response.success) {
        setSuccess('Profile updated successfully');
        setEditing(false);
        updateUser(response.data);
        await loadProfile();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setError('');
    setSuccess('');
    // Reset form data
    if (profileData) {
      setFormData({
        dateOfBirth: profileData.dateOfBirth || '',
        gender: profileData.gender || '',
        phone: profileData.phone || '',
        address: profileData.address || '',
        panMasked: profileData.panMasked || '',
        aadhaarMasked: profileData.aadhaarMasked || '',
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading profile..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="profile">
        <div className="profile__header">
          <h1>My Profile</h1>
          <p className="text-secondary">View and edit your profile information</p>
        </div>

        <Card>
          <div className="profile__section">
            <h2 className="neo-section__header">Identity (Read-Only)</h2>
            <p className="text-secondary profile__section-description">
              These fields are immutable and cannot be changed
            </p>
            
            <Input
              label="Employee ID (xID)"
              value={profileData?.xID || ''}
              readOnly
              disabled
            />

            <Input
              label="Name"
              value={profileData?.name || ''}
              readOnly
              disabled
            />

            <Input
              label="Email"
              value={profileData?.email || ''}
              readOnly
              disabled
            />

            <Input
              label="Role"
              value={profileData?.role || ''}
              readOnly
              disabled
            />
          </div>

          <div className="profile__section">
            <h2 className="neo-section__header">Personal Information (Editable)</h2>
            
            <Input
              label="Date of Birth"
              name="dateOfBirth"
              type="date"
              value={formData.dateOfBirth}
              onChange={handleChange}
              disabled={!editing}
            />

            <div className="neo-form-group">
              <label className="neo-label">Gender</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                disabled={!editing}
                className="neo-select"
              >
                <option value="" disabled>Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <Input
              label="Phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              disabled={!editing}
              placeholder="10-digit mobile number"
            />

            <Input
              label="Address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              disabled={!editing}
              placeholder="Full address"
            />

            <Input
              label="PAN (Masked)"
              name="panMasked"
              value={formData.panMasked}
              onChange={handleChange}
              disabled={!editing}
              maxLength={10}
              placeholder="ABCDE1234F"
            />
            {editing && (
              <p className="text-secondary profile__field-hint">
                Format: ABCDE1234F (masked)
              </p>
            )}

            <Input
              label="Aadhaar (Masked)"
              name="aadhaarMasked"
              value={formData.aadhaarMasked}
              onChange={handleChange}
              disabled={!editing}
              placeholder="XXXX-XXXX-1234"
            />
            {editing && (
              <p className="text-secondary profile__field-hint">
                Format: XXXX-XXXX-1234 (only last 4 digits visible)
              </p>
            )}

            {error && (
              <div className="neo-alert neo-alert--danger">
                {error}
              </div>
            )}

            {success && (
              <div className="neo-alert neo-alert--success">
                {success}
              </div>
            )}

            <div className="profile__actions">
              {editing ? (
                <>
                  <Button onClick={handleCancel}>Cancel</Button>
                  <Button variant="primary" onClick={handleSave} disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              ) : (
                <Button variant="primary" onClick={() => setEditing(true)}>
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
};
