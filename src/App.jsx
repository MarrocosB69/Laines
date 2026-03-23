import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PacienteProvider } from './contexts/PacienteContext';
import { UiFeedbackProvider } from './contexts/UiFeedbackContext';

import PrivateRoute from './components/shared/PrivateRoute';
import PasswordChangeModal from './components/Auth/PasswordChangeModal';
import ProfileCompletionModal from './components/Auth/ProfileCompletionModal';
import {
  ADMIN_ROLES,
  ADMIN_AREA_ROLES,
  PROFESSOR_AREA_ROLES,
  getRedirectPathFromRole
} from './constants/roles';
import { getProfileCompletionState } from './utils/profileCompletion';

import './App.css';

const LoginPage = React.lazy(() => import('./views/LoginPage'));
const AdminView = React.lazy(() => import('./views/admin/AdminView/AdminView'));
const StudentView = React.lazy(() => import('./views/Student/StudentView/StudentView'));
const AvaliacaoCompleta = React.lazy(() => import('./views/AvaliacaoCompleta'));
const ProfessorView = React.lazy(() => import('./views/professor/ProfessorView'));
const TeamPortal = React.lazy(() => import('./views/Team/TeamPortal'));
const AthletePortal = React.lazy(() => import('./views/Athlete/AthletePortal'));

function AppContent() {
  const { user, loading } = useAuth();
  const profileCompletionState = React.useMemo(() => getProfileCompletionState(user), [user]);

  const renderPageFallback = (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  if (loading) {
    return renderPageFallback;
  }

  return (
    <>
      <PasswordChangeModal
        isOpen={!!user?.mustChangePassword}
        user={user}
      />
      <ProfileCompletionModal
        isOpen={!!user && !user?.mustChangePassword && !profileCompletionState.complete}
        user={user}
      />
      <React.Suspense fallback={renderPageFallback}>
        <Routes>
          <Route path="/" element={!user ? <LoginPage /> : <Navigate to={getRedirectPathFromRole(user.role)} replace />} />
          <Route path="/login" element={!user ? <LoginPage /> : <Navigate to={getRedirectPathFromRole(user.role)} replace />} />

          <Route path="/aluno" element={
            <PrivateRoute allowedRoles={['aluno', 'student']}>
              <StudentView />
            </PrivateRoute>
          } />

          <Route path="/student" element={<Navigate to="/aluno" replace />} />

          <Route path="/professor" element={
            <PrivateRoute allowedRoles={PROFESSOR_AREA_ROLES}>
              <ProfessorView />
            </PrivateRoute>
          } />

          <Route path="/equipe" element={
            <PrivateRoute allowedRoles={['tecnico']}>
              <TeamPortal />
            </PrivateRoute>
          } />

          <Route path="/atleta" element={
            <PrivateRoute allowedRoles={['atleta']}>
              <AthletePortal />
            </PrivateRoute>
          } />

          <Route path="/admin" element={
            <PrivateRoute allowedRoles={ADMIN_AREA_ROLES}>
              <AdminView />
            </PrivateRoute>
          } />

          <Route path="/avaliacao/:id" element={
            <PrivateRoute allowedRoles={['aluno', ...PROFESSOR_AREA_ROLES, ...ADMIN_ROLES]}>
              <AvaliacaoCompleta />
            </PrivateRoute>
          } />

          <Route path="*" element={<Navigate to={getRedirectPathFromRole(user?.role)} replace />} />
        </Routes>
      </React.Suspense>
    </>
  );
}

function App() {
  return (
    <Router>
      <UiFeedbackProvider>
        <AuthProvider>
          <PacienteProvider>
            <AppContent />
          </PacienteProvider>
        </AuthProvider>
      </UiFeedbackProvider>
    </Router>
  );
}

export default App;

