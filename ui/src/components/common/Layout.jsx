/**
 * Layout Component
 * Main layout with navigation
 */

import React from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import './Layout.css';

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const { firmSlug } = useParams();

  // Get firmSlug from URL params or user data
  const currentFirmSlug = firmSlug || user?.firmSlug;

  const handleLogout = async () => {
    await logout();
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

  return (
    <div className="layout">
      <nav className="layout__nav">
        <div className="layout__nav-container">
          <div className="layout__brand">
            <h1>Docketra</h1>
          </div>
          <div className="layout__nav-links">
            <Link
              to={`/${currentFirmSlug}/dashboard`}
              className={`layout__nav-link ${isActive(`/${currentFirmSlug}/dashboard`) ? 'active' : ''}`}
            >
              Dashboard
            </Link>
            <Link
              to={`/${currentFirmSlug}/global-worklist`}
              className={`layout__nav-link ${isActive(`/${currentFirmSlug}/global-worklist`) ? 'active' : ''}`}
            >
              Workbasket
            </Link>
            <Link
              to={`/${currentFirmSlug}/worklist`}
              className={`layout__nav-link ${isActive(`/${currentFirmSlug}/worklist`) ? 'active' : ''}`}
            >
              My Worklist
            </Link>
            <Link
              to={`/${currentFirmSlug}/cases/create`}
              className={`layout__nav-link ${isActive(`/${currentFirmSlug}/cases/create`) ? 'active' : ''}`}
            >
              Create Case
            </Link>
            {isAdmin && (
              <Link
                to={`/${currentFirmSlug}/admin`}
                className={`layout__nav-link ${isActive(`/${currentFirmSlug}/admin`) ? 'active' : ''}`}
              >
                Admin
              </Link>
            )}
          </div>
          <div className="layout__nav-user">
            <Link to={`/${currentFirmSlug}/profile`} className="layout__nav-link">
              {user?.name || user?.xID}
            </Link>
            <button onClick={handleLogout} className="neo-button">
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="layout__main">{children}</main>
    </div>
  );
};
