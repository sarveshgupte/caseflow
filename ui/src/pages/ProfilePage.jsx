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
    dob: '',
    phone: '',
    address: '',
    pan: '',
    aadhaar: '',
    email: '',
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
          dob: response.data.dob || '',
          phone: response.data.phone || '',
          address: response.data.address || '',
          pan: response.data.pan || '',
          aadhaar: response.data.aadhaar || '',
          email: response.data.email || '',
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
        dob: profileData.dob || '',
        phone: profileData.phone || '',
        address: profileData.address || '',
        pan: profileData.pan || '',
        aadhaar: profileData.aadhaar || '',
        email: profileData.email || '',
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
            <h2 className="neo-section__header">Personal Information</h2>
            
            <Input
              label="Name"
              value={profileData?.name || ''}
              readOnly
              disabled
            />

            <Input
              label="xID"
              value={profileData?.xID || ''}
              readOnly
              disabled
            />

            <Input
              label="Date of Birth"
              name="dob"
              type="date"
              value={formData.dob}
              onChange={handleChange}
              disabled={!editing}
            />

            <Input
              label="Phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              disabled={!editing}
            />

            <Input
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              disabled={!editing}
            />

            <Input
              label="Address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              disabled={!editing}
            />

            <Input
              label="PAN"
              name="pan"
              value={formData.pan}
              onChange={handleChange}
              disabled={!editing}
              maxLength={10}
            />

            <Input
              label="Aadhaar"
              name="aadhaar"
              value={formData.aadhaar}
              onChange={handleChange}
              disabled={!editing}
              maxLength={12}
            />

            {profileData?.passwordExpiryDate && (
              <div className="profile__info">
                <span className="text-secondary">Password Expiry:</span>
                <span>{formatDate(profileData.passwordExpiryDate)}</span>
              </div>
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
