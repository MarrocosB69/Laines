import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUiFeedback } from './UiFeedbackContext';
import api, { AUTH_EXPIRED_EVENT, getApiErrorMessage } from '../services/api';
import {
  broadcastAuthSync,
  hasAccessToken,
  isNewAuthFlowEnabled,
  setAccessToken,
  subscribeAuthSync
} from '../services/sessionToken';
import { ADMIN_ROLES, PROFESSOR_AREA_ROLES, normalizeRole } from '../constants/roles';
import { normalizeUserRecord } from '../utils/userAdapter';

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { notify } = useUiFeedback();

  const buildUser = useCallback((data) => {
    const normalized = normalizeUserRecord(data);
    if (!normalized) return null;
    const role = normalizeRole(normalized.role);
    return {
      ...normalized,
      role,
      mustChangePassword: !!normalized.mustChangePassword,
      isAdmin: ADMIN_ROLES.includes(role),
      isProfessor: PROFESSOR_AREA_ROLES.includes(role),
      isAluno: role === 'aluno',
      isTecnico: role === 'tecnico',
      isAtleta: role === 'atleta'
    };
  }, []);

  const saveToken = useCallback((token) => {
    setAccessToken(token);
  }, []);

  const loadSession = useCallback(async () => {
    const newAuthFlow = isNewAuthFlowEnabled();
    if (!newAuthFlow && !hasAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get('/auth/me');
      setUser(buildUser(data));
    } catch (error) {
      const status = Number(error?.response?.status || 0);
      if (status !== 401) {
        notify({
          type: 'warning',
          title: 'Sessão encerrada',
          message: 'Sua sessão foi encerrada ou revogada. Faça login novamente.'
        });
      }
      console.error('Falha ao carregar sessão:', error);
      saveToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [buildUser, notify, saveToken]);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    const normalized = buildUser(data);
    setUser(normalized);
    return normalized;
  }, [buildUser]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onAuthExpired = () => {
      saveToken(null);
      setUser((currentUser) => {
        if (currentUser) {
          notify({
            type: 'warning',
            title: 'Sessão expirada',
            message: 'Faça login novamente para continuar.'
          });
        }
        return null;
      });
    };

    const unsubscribeAuthSync = subscribeAuthSync(({ type }) => {
      if (type === 'logout') {
        saveToken(null);
        setUser(null);
        return;
      }
      if (type === 'expired') {
        onAuthExpired();
      }
    });

    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
      unsubscribeAuthSync();
    };
  }, [notify, saveToken]);

  const login = useCallback(async (email, password) => {
    try {
      if (!email || !email.trim()) {
        throw new Error('E-mail obrigatório');
      }
      if (!password) {
        throw new Error('Senha obrigatória');
      }

      const cleanEmail = email.trim().toLowerCase();
      const authFlowHeader = isNewAuthFlowEnabled() ? { 'x-auth-flow': 'v2' } : undefined;
      const { data } = await api.post('/auth/login', { email: cleanEmail, password }, {
        headers: authFlowHeader
      });
      saveToken(data?.accessToken);
      try {
        const fullUser = await refreshUser();
        return fullUser;
      } catch {
        const fallbackUser = buildUser(data?.user);
        setUser(fallbackUser);
        return fallbackUser;
      }
    } catch (error) {
      console.error('Erro no login:', error);
      const apiMessage = getApiErrorMessage(error, 'E-mail ou senha inválidos. Verifique e tente novamente.');
      notify({
        type: 'error',
        title: 'Falha no login',
        message: apiMessage
      });
      throw error;
    }
  }, [buildUser, notify, refreshUser, saveToken]);

  const logout = useCallback(async () => {
    try {
      const newAuthFlow = isNewAuthFlowEnabled();
      if (newAuthFlow) {
        try {
          await api.post('/auth/logout', undefined, {
            skipAuthRefresh: true
          });
        } catch {
          // Best effort no backend: encerra sessão local mesmo assim.
        }
      } else if (hasAccessToken()) {
        try {
          await api.post('/auth/logout-all');
        } catch {
          // Best effort no backend: encerra sessão local mesmo assim.
        }
      }
      saveToken(null);
      setUser(null);
      broadcastAuthSync('logout');
    } catch (error) {
      console.error('Erro ao sair:', error);
      notify({
        type: 'error',
        title: 'Falha ao sair',
        message: getApiErrorMessage(error, 'Não foi possível encerrar a sessão.')
      });
    }
  }, [notify, saveToken]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const payload = { currentPassword, newPassword };
    const { data } = await api.post('/auth/change-password', payload);
    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
    return data;
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const { data } = await api.patch('/auth/profile', payload);
    const normalized = buildUser(data);
    setUser(normalized);
    return normalized;
  }, [buildUser]);

  const listSupervisors = useCallback(async () => {
    const { data } = await api.get('/auth/supervisors');
    return Array.isArray(data) ? data : [];
  }, []);

  const value = {
    user,
    signed: !!user,
    loading,
    login,
    logout,
    changePassword,
    updateProfile,
    listSupervisors,
    refreshUser,
    isAdmin: user?.isAdmin || false,
    isProfessor: user?.isProfessor || false,
    isAluno: user?.isAluno || false,
    isTecnico: user?.isTecnico || false,
    isAtleta: user?.isAtleta || false,
    mustChangePassword: user?.mustChangePassword || false
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
