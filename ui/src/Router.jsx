/**
 * Router Configuration
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
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
import { ReportsDashboard } from './pages/reports/ReportsDashboard';
import { DetailedReports } from './pages/reports/DetailedReports';
import { FilteredCasesPage } from './pages/FilteredCasesPage';

export const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/worklist"
          element={
            <ProtectedRoute>
              <WorklistPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/my-worklist"
          element={
            <ProtectedRoute>
              <WorklistPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/global-worklist"
          element={
            <ProtectedRoute>
              <WorkbasketPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/cases/:caseId"
          element={
            <ProtectedRoute>
              <CaseDetailPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/cases"
          element={
            <ProtectedRoute requireAdmin>
              <FilteredCasesPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/cases/create"
          element={
            <ProtectedRoute>
              <CreateCasePage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute requireAdmin>
              <ReportsDashboard />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/admin/reports/detailed"
          element={
            <ProtectedRoute requireAdmin>
              <DetailedReports />
            </ProtectedRoute>
          }
        />
        
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
