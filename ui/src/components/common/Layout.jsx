/**
 * Layout Component
 * Main layout with navigation
 */

import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import './Layout.css';

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { isAdmin } = usePermissions();
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
    <div className="layout">
      <nav className="layout__nav">
        <div className="layout__nav-container">
          <div className="layout__brand">
            <h1>Docketra</h1>
          </div>
          <div className="layout__nav-links">
            <Link
              to="/dashboard"
              className={`layout__nav-link ${isActive('/dashboard') ? 'active' : ''}`}
            >
              Dashboard
            </Link>
            <Link
              to="/global-worklist"
              className={`layout__nav-link ${isActive('/global-worklist') ? 'active' : ''}`}
            >
              Workbasket
            </Link>
            <Link
              to="/worklist"
              className={`layout__nav-link ${isActive('/worklist') ? 'active' : ''}`}
            >
              My Worklist
            </Link>
            <Link
              to="/cases/create"
              className={`layout__nav-link ${isActive('/cases/create') ? 'active' : ''}`}
            >
              Create Case
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className={`layout__nav-link ${isActive('/admin') ? 'active' : ''}`}
              >
                Admin
              </Link>
            )}
          </div>
          <div className="layout__nav-user">
            <Link to="/profile" className="layout__nav-link">
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
