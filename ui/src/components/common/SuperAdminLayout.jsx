/**
 * SuperAdmin Layout Component
 * Minimal layout for platform-level management
 */

import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './SuperAdminLayout.css';

export const SuperAdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="superadmin-layout">
      <nav className="superadmin-layout__nav">
        <div className="superadmin-layout__nav-container">
          <div className="superadmin-layout__brand">
            <h1>Docketra Platform</h1>
            <span className="superadmin-layout__badge">SuperAdmin</span>
          </div>
          <div className="superadmin-layout__nav-links">
            <Link
              to="/superadmin"
              className={`superadmin-layout__nav-link ${isActive('/superadmin') ? 'active' : ''}`}
            >
              Platform Dashboard
            </Link>
            <Link
              to="/superadmin/firms"
              className={`superadmin-layout__nav-link ${isActive('/superadmin/firms') ? 'active' : ''}`}
            >
              Firms
            </Link>
          </div>
          <div className="superadmin-layout__nav-user">
            <span className="superadmin-layout__user-info">
              {user?.xID} (SuperAdmin)
            </span>
            <button onClick={handleLogout} className="neo-button">
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="superadmin-layout__main">{children}</main>
    </div>
  );
};
