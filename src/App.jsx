import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PacienteProvider } from './contexts/PacienteContext';
import { UiFeedbackProvider } from './contexts/UiFeedbackContext';

import PrivateRoute from './components/shared/PrivateRoute';
import ErrorBoundary from './components/shared/ErrorBoundary';
import PasswordChangeModal from './components/Auth/PasswordChangeModal';
import ProfileCompletionModal from './components/Auth/ProfileCompletionModal';
import {
  ADMIN_ROLES,
  ADMIN_AREA_ROLES,
  PROFESSOR_AREA_ROLES,
  STUDENT_MEMBER_ROLES,
  DIRETORIA_ROLES,
  getRedirecionamentoPaginaUnica,
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
const AthleteView = React.lazy(() => import('./views/Athlete/AthleteView'));
const PrescricaoPlanoAlimentar = React.lazy(() => import('./views/planos/PrescricaoPlanoAlimentar'));
// Tela de prescricao integrada a API, com calculo no nucleo compartilhado
// e contrato versionado para salvar, revisar e publicar o plano.
const PrescricaoPlano = React.lazy(() => import('./views/planos/PrescricaoPlano'));
const RouteSidebarLayout = React.lazy(() => import('./views/shared/RouteSidebarLayout'));
const NotFound = React.lazy(() => import('./views/NotFound'));
const InscricaoPublica = React.lazy(() => import('./views/public/InscricaoPublica'));

function AppContent() {
  const { user, loading } = useAuth();
  const profileCompletionState = React.useMemo(() => getProfileCompletionState(user), [user]);

  const renderPageFallback = (
    <div className="flex h-screen items-center justify-center bg-[var(--color-surface)]">
      <div className="w-full max-w-md space-y-3 px-6">
        <div className="skeleton skeleton-line h-4 w-1/2" />
        <div className="skeleton skeleton-card h-20 w-full" />
        <div className="skeleton skeleton-card h-20 w-full" />
      </div>
    </div>
  );

  if (loading) {
    return renderPageFallback;
  }

  return (
    <ErrorBoundary>
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
            <Route path="/" element={!user ? <LoginPage /> : <Navigate to={getRedirectPathFromRole(user.role, user)} replace />} />
            <Route path="/recuperar-senha" element={<LoginPage />} />
            <Route path="/login" element={!user ? <LoginPage /> : <Navigate to={getRedirectPathFromRole(user.role, user)} replace />} />
            <Route path="/inscricao" element={<InscricaoPublica />} />

            <Route path="/aluno" element={
              <PrivateRoute allowedRoles={[...STUDENT_MEMBER_ROLES, ...DIRETORIA_ROLES, 'student']}>
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
                <AthleteView />
              </PrivateRoute>
            } />

            <Route path="/admin" element={
              <PrivateRoute allowedRoles={ADMIN_AREA_ROLES} fallbackCheck={(u) => u?.canAccessAdmin}>
                <PainelOuPaginaUnica />
              </PrivateRoute>
            } />

            <Route path="/avaliacao/:id" element={
              <PrivateRoute allowedRoles={[...STUDENT_MEMBER_ROLES, ...PROFESSOR_AREA_ROLES, ...ADMIN_ROLES]}>
                <RouteSidebarLayout>
                  <AvaliacaoCompleta />
                </RouteSidebarLayout>
              </PrivateRoute>
            } />

            <Route path="/prescricao-plano/:pacienteId" element={
              <PrivateRoute allowedRoles={[...STUDENT_MEMBER_ROLES, ...PROFESSOR_AREA_ROLES, ...ADMIN_ROLES, 'tecnico']}>
                <RouteSidebarLayout>
                  <PrescricaoPlano />
                </RouteSidebarLayout>
              </PrivateRoute>
            } />

            {/* A tela antiga pedia GET /planos-alimentares/<id>, mas o id da rota
                e de PACIENTE, nao de plano — dava 404. Como a prescricao agora
                vive em /prescricao-plano, links e historico antigos vem para ca. */}
            <Route
              path="/planos-alimentares/:pacienteId"
              element={<RedirecionaPrescricao />}
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </React.Suspense>
      </>
    </ErrorBoundary>
  );
}

/**
 * WI-015: quem tem dois papéis (aluno presidente ou vice com gestão, professor
 * com o painel) usa a página de origem, que já reúne a gestão. /admin, com ou
 * sem ?tab=, leva à aba equivalente de lá; os demais continuam no painel.
 */
function PainelOuPaginaUnica() {
  const { user } = useAuth();
  const location = useLocation();
  const tab = new URLSearchParams(location.search).get('tab') || '';
  const destino = getRedirecionamentoPaginaUnica(user, { tab, state: location.state });
  if (destino) return <Navigate to={destino.to} state={destino.state} replace />;
  return <AdminView />;
}

/** Preserva o paciente da URL ao mandar o link antigo para a tela nova. */
function RedirecionaPrescricao() {
  const { pacienteId } = useParams();
  return <Navigate to={`/prescricao-plano/${pacienteId}`} replace />;
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

