/**
 * Enterprise Layout Component
 * Top navigation header layout - Desktop-first, persistent navigation
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import './Layout.css';

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { isAdmin, isSuperadmin } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const { firmSlug } = useParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  
  // Ref for dropdown outside click detection
  const profileDropdownRef = useRef(null);

  // Get firmSlug from URL params or user data
  const currentFirmSlug = firmSlug || user?.firmSlug;

  const handleLogout = async () => {
    await logout({ preserveFirmSlug: !!currentFirmSlug });
    // Redirect to firm login if firmSlug is available
    if (currentFirmSlug) {
      navigate(`/f/${currentFirmSlug}/login`);
    } else {
      navigate('/login');
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (user?.name) {
      return user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    return user?.xID?.substring(0, 2)?.toUpperCase() || 'U';
  };

  // Check if user has admin access (Admin or SuperAdmin)
  const hasAdminAccess = isAdmin || isSuperadmin;

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close dropdowns on route change
  useEffect(() => {
    setProfileDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Reusable chevron icon
  const ChevronIcon = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div className="enterprise-layout-top">
      {/* Top Navigation Header */}
      <header className="enterprise-top-header">
        <div className="enterprise-top-header__container">
          {/* Left: Logo */}
          <div className="enterprise-top-header__left">
            <Link 
              to={`/f/${currentFirmSlug}/dashboard`}
              className="enterprise-top-header__logo"
            >
              <h1>Docketra</h1>
            </Link>
          </div>
          
          {/* Center: Primary Navigation */}
          <nav className="enterprise-top-header__nav">
            <Link
              to={`/f/${currentFirmSlug}/dashboard`}
              className={`enterprise-top-header__nav-link ${isActive(`/f/${currentFirmSlug}/dashboard`) ? 'active' : ''}`}
            >
              Dashboard
            </Link>
            <Link
              to={`/f/${currentFirmSlug}/global-worklist`}
              className={`enterprise-top-header__nav-link ${isActive(`/f/${currentFirmSlug}/global-worklist`) ? 'active' : ''}`}
            >
              Workbasket
            </Link>
            <Link
              to={`/f/${currentFirmSlug}/worklist`}
              className={`enterprise-top-header__nav-link ${isActive(`/f/${currentFirmSlug}/worklist`) ? 'active' : ''}`}
            >
              My Worklist
            </Link>
          </nav>

          {/* Primary Action */}
          <div className="enterprise-top-header__action">
            <button
              onClick={() => navigate(`/f/${currentFirmSlug}/cases/create`)}
              className="btn-primary-cta"
            >
              Create Case
            </button>
          </div>

          {/* Admin Link (conditional) */}
          {hasAdminAccess && (
            <div className="enterprise-top-header__admin">
              <Link
                to={`/f/${currentFirmSlug}/admin`}
                className={`enterprise-top-header__nav-link ${location.pathname.startsWith(`/f/${currentFirmSlug}/admin`) ? 'active' : ''}`}
              >
                Admin
              </Link>
            </div>
          )}
          
          {/* Right: Search, Notifications, Profile */}
          <div className="enterprise-top-header__right">
            {/* Global Search */}
            <div className="enterprise-top-header__search">
              <input 
                type="text"
                placeholder="Search..."
                className="enterprise-top-header__search-input"
              />
            </div>
            
            {/* Notification Bell */}
            <button 
              className="enterprise-top-header__icon-btn" 
              aria-label="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 2C7.23858 2 5 4.23858 5 7V10L3 12V13H17V12L15 10V7C15 4.23858 12.7614 2 10 2Z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8.5 17C8.5 18.1046 9.39543 19 10.5 19C11.6046 19 12.5 18.1046 12.5 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            
            {/* User Profile Menu */}
            <div className="dropdown" ref={profileDropdownRef}>
              <button
                className="enterprise-top-header__profile"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                aria-expanded={profileDropdownOpen}
              >
                <div className="enterprise-top-header__user-avatar">
                  {getUserInitials()}
                </div>
                <span className="enterprise-top-header__user-name">
                  {user?.name || user?.xID}
                </span>
                <ChevronIcon />
              </button>
              {profileDropdownOpen && (
                <div className="dropdown-menu dropdown-menu-right">
                  <Link
                    to={`/f/${currentFirmSlug}/profile`}
                    className="dropdown-item"
                    onClick={() => setProfileDropdownOpen(false)}
                  >
                    Profile
                  </Link>
                  <button
                    className="dropdown-item"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Hamburger Menu */}
          <button 
            className="enterprise-top-header__mobile-toggle"
            onClick={toggleMobileMenu}
            aria-label="Toggle mobile menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="enterprise-top-header__mobile-menu">
            <Link
              to={`/f/${currentFirmSlug}/dashboard`}
              className={`enterprise-top-header__mobile-link ${isActive(`/f/${currentFirmSlug}/dashboard`) ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              to={`/f/${currentFirmSlug}/global-worklist`}
              className={`enterprise-top-header__mobile-link ${isActive(`/f/${currentFirmSlug}/global-worklist`) ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Workbasket
            </Link>
            <Link
              to={`/f/${currentFirmSlug}/worklist`}
              className={`enterprise-top-header__mobile-link ${isActive(`/f/${currentFirmSlug}/worklist`) ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              My Worklist
            </Link>
            <button
              onClick={() => {
                navigate(`/f/${currentFirmSlug}/cases/create`);
                setMobileMenuOpen(false);
              }}
              className="btn-primary-cta btn-primary-cta--mobile"
            >
              Create Case
            </button>
            {hasAdminAccess && (
              <Link
                to={`/f/${currentFirmSlug}/admin`}
                className={`enterprise-top-header__mobile-link ${location.pathname.startsWith(`/f/${currentFirmSlug}/admin`) ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Admin
              </Link>
            )}
          </div>
        )}
      </header>

      {/* Content Area */}
      <main className="enterprise-top-content">
        {children}
      </main>
    </div>
  );
};
