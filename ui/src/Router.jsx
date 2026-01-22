/**
 * Router Configuration
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { FirmLayout } from './components/routing/FirmLayout';
import { DefaultRoute } from './components/routing/DefaultRoute';
import { LoginPage } from './pages/LoginPage';
import { FirmLoginPage } from './pages/FirmLoginPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { WorklistPage } from './pages/WorklistPage';
import { WorkbasketPage } from './pages/WorkbasketPage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { CreateCasePage } from './pages/CreateCasePage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { SuperadminDashboard } from './pages/SuperadminDashboard';
import { PlatformDashboard } from './pages/PlatformDashboard';
import { FirmsManagement } from './pages/FirmsManagement';
import { ReportsDashboard } from './pages/reports/ReportsDashboard';
import { DetailedReports } from './pages/reports/DetailedReports';
import { FilteredCasesPage } from './pages/FilteredCasesPage';
import { CasesPage } from './pages/CasesPage';
import { GoogleCallbackPage } from './pages/GoogleCallbackPage';

const LegacyFirmRedirect = () => {
  const { firmSlug } = useParams();
  const location = useLocation();
  const suffix = location.pathname.replace(`/${firmSlug}`, '') || '/dashboard';
  const target = `/f/${firmSlug}${suffix}${location.search || ''}`;
  return <Navigate to={target} replace />;
};

export const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
          {/* Public Login Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/f/:firmSlug/login" element={<FirmLoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route path="/google-callback" element={<GoogleCallbackPage />} />
          
          {/* SuperAdmin Routes - NOT firm-scoped */}
          <Route
            path="/superadmin"
            element={
              <ProtectedRoute requireSuperadmin>
                <PlatformDashboard />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/superadmin/firms"
            element={
              <ProtectedRoute requireSuperadmin>
                <FirmsManagement />
              </ProtectedRoute>
            }
          />
          
          {/* Firm-Scoped Routes for Regular Users */}
          <Route path="/f/:firmSlug" element={<FirmLayout />}>
            <Route
              path="dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="worklist"
              element={
                <ProtectedRoute>
                  <WorklistPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="my-worklist"
              element={
                <ProtectedRoute>
                  <WorklistPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="global-worklist"
              element={
                <ProtectedRoute>
                  <WorkbasketPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="cases/:caseId"
              element={
                <ProtectedRoute>
                  <CaseDetailPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="cases"
              element={
                <ProtectedRoute>
                  <CasesPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="cases/create"
              element={
                <ProtectedRoute>
                  <CreateCasePage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="admin/reports"
              element={
                <ProtectedRoute requireAdmin>
                  <ReportsDashboard />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="admin/reports/detailed"
              element={
                <ProtectedRoute requireAdmin>
                  <DetailedReports />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="/" element={<DefaultRoute />} />
          <Route path="/:firmSlug/*" element={<LegacyFirmRedirect />} />
          <Route path="*" element={<DefaultRoute />} />
        </Routes>
    </BrowserRouter>
  );
};
