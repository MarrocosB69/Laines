import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Palette,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  Shield,
  User
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { normalizeRole } from '../../../constants/roles';
import { guardAction } from '../../../utils/actionFeedback';
import SettingsTabContent from './settings/SettingsTabContent';
import {
  DEFAULT_SETTINGS,
  normalizeSettingsPayload,
  SETTINGS_ALLOWED_ROLES,
  SETTINGS_AUDIT_ACTION,
  SETTINGS_AUDIT_ENTITY,
  SETTINGS_AUDIT_SCOPE
} from './settings/settingsModel';

import './SettingsPage.css';

const isEndpointUnavailable = (error) => {
  const status = Number(error?.response?.status || 0);
  return status === 404 || status === 405 || status === 501;
};

const SettingsPage = () => {
  const { user } = useAuth();
  const { confirm, notify } = useUiFeedback();

  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS }));
  const [savedSnapshot, setSavedSnapshot] = useState(() => ({ ...DEFAULT_SETTINGS }));
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [saveMessage, setSaveMessage] = useState(null);
  const [lastSavedMeta, setLastSavedMeta] = useState(null);

  const canManageSettings = SETTINGS_ALLOWED_ROLES.has(normalizeRole(user?.role));

  const tabs = useMemo(() => [
    { id: 'profile', label: 'Perfil', icon: <User size={18} /> },
    { id: 'system', label: 'Sistema', icon: <SettingsIcon size={18} /> },
    { id: 'notifications', label: 'Notificações', icon: <Bell size={18} /> },
    { id: 'security', label: 'Segurança', icon: <Shield size={18} /> },
    { id: 'appearance', label: 'Aparência', icon: <Palette size={18} /> }
  ], []);

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const ensureCanManageSettings = useCallback((actionLabel = 'Gerenciar configurações') => (
    guardAction(notify, canManageSettings, {
      actionLabel,
      reason: 'Seu perfil não possui permissão para alterar configurações do sistema.'
    })
  ), [canManageSettings, notify]);

  const hasUnsavedChanges = useMemo(() => (
    Object.keys(DEFAULT_SETTINGS).some((key) => settings[key] !== savedSnapshot[key])
  ), [savedSnapshot, settings]);

  const lastSavedLabel = useMemo(() => {
    if (!lastSavedMeta?.at) return 'Sem persistência registrada';
    const parsed = new Date(lastSavedMeta.at);
    if (Number.isNaN(parsed.getTime())) return 'Persistido sem timestamp válido';
    const by = lastSavedMeta?.by ? ` por ${lastSavedMeta.by}` : '';
    return `Persistido em ${parsed.toLocaleString('pt-BR')}${by}`;
  }, [lastSavedMeta?.at, lastSavedMeta?.by]);

  const loadLegacySettingsFromAudit = useCallback(async () => {
    const { data } = await api.get('/auditoria', {
      params: {
        action: SETTINGS_AUDIT_ACTION,
        entity: SETTINGS_AUDIT_ENTITY,
        entityId: SETTINGS_AUDIT_SCOPE,
        limit: 1
      }
    });
    const latest = Array.isArray(data) ? data[0] : null;
    const persistedRaw = latest?.meta?.settings;
    const normalized = normalizeSettingsPayload(persistedRaw);
    setSettings(normalized);
    setSavedSnapshot(normalized);
    if (latest) {
      setLastSavedMeta({
        at: latest.createdAt || null,
        by: latest?.actor?.name || latest?.actor?.email || ''
      });
    }
  }, []);

  const persistLegacySettingsToAudit = useCallback(async (normalized, changedKeys, mode) => {
    await api.post('/auditoria', {
      action: SETTINGS_AUDIT_ACTION,
      entity: SETTINGS_AUDIT_ENTITY,
      entityId: SETTINGS_AUDIT_SCOPE,
      meta: {
        settings: normalized,
        changedKeys,
        mode
      }
    });
  }, []);

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      setIsLoadingSettings(true);
      try {
        const { data } = await api.get('/settings/admin-console');
        const normalized = normalizeSettingsPayload(data?.settings);
        if (!active) return;
        setSettings(normalized);
        setSavedSnapshot(normalized);
        if (data?.updatedAt || data?.updatedBy) {
          setLastSavedMeta({
            at: data?.updatedAt || null,
            by: data?.updatedBy?.name || data?.updatedBy?.email || ''
          });
        }
      } catch (error) {
        if (isEndpointUnavailable(error)) {
          try {
            await loadLegacySettingsFromAudit();
            return;
          } catch (legacyError) {
            if (!active) return;
            notify({
              type: 'error',
              title: 'Erro ao carregar configurações',
              message: getApiErrorMessage(legacyError, 'Não foi possível carregar as configurações persistidas.')
            });
            return;
          }
        }
        const status = Number(error?.response?.status || 0);
        if (status !== 403) {
          notify({
            type: 'error',
            title: 'Erro ao carregar configurações',
            message: getApiErrorMessage(error, 'Não foi possível carregar as configurações persistidas.')
          });
        }
      } finally {
        if (active) setIsLoadingSettings(false);
      }
    };

    loadSettings();
    return () => {
      active = false;
    };
  }, [loadLegacySettingsFromAudit, notify]);

  const persistSettings = useCallback(async (nextSettings, mode = 'manual') => {
    if (!ensureCanManageSettings('Salvar configurações')) return false;

    const normalized = normalizeSettingsPayload(nextSettings);
    const changedKeys = Object.keys(DEFAULT_SETTINGS)
      .filter((key) => normalized[key] !== savedSnapshot[key]);

    setIsSaving(true);
    try {
      let persistedMeta = {
        at: new Date().toISOString(),
        by: user?.name || user?.email || ''
      };
      try {
        const { data } = await api.patch('/settings/admin-console', {
          ...normalized,
          mode
        });
        persistedMeta = {
          at: data?.updatedAt || persistedMeta.at,
          by: data?.updatedBy?.name || data?.updatedBy?.email || persistedMeta.by
        };
      } catch (error) {
        if (!isEndpointUnavailable(error)) {
          throw error;
        }
        await persistLegacySettingsToAudit(normalized, changedKeys, mode);
      }

      setSettings(normalized);
      setSavedSnapshot(normalized);
      setLastSavedMeta(persistedMeta);
      setSaveMessage({
        type: 'success',
        text: 'Configurações salvas com sucesso.'
      });
      notify({
        type: 'success',
        title: 'Configurações persistidas',
        message: changedKeys.length > 0
          ? `${changedKeys.length} campo(s) atualizado(s) com auditoria.`
          : 'Nenhuma alteração pendente para salvar.'
      });
      setTimeout(() => setSaveMessage(null), 3000);
      return true;
    } catch (error) {
      const message = getApiErrorMessage(error, 'Não foi possível persistir as configurações.');
      setSaveMessage({
        type: 'error',
        text: message
      });
      notify({
        type: 'error',
        title: 'Erro ao salvar configurações',
        message
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [ensureCanManageSettings, notify, persistLegacySettingsToAudit, savedSnapshot, user?.email, user?.name]);

  const handleSave = useCallback(async () => {
    await persistSettings(settings, 'manual');
  }, [persistSettings, settings]);

  const handleReset = useCallback(async () => {
    if (!ensureCanManageSettings('Restaurar configurações')) return;
    const accepted = await confirm({
      title: 'Restaurar configurações',
      message: 'Tem certeza que deseja resetar todas as configurações para os valores padrão?',
      confirmLabel: 'Restaurar',
      cancelLabel: 'Cancelar',
      variant: 'warning'
    });
    if (!accepted) return;

    await persistSettings(DEFAULT_SETTINGS, 'reset');
  }, [confirm, ensureCanManageSettings, persistSettings]);

  // MotionConfig: com "reduzir movimento" no sistema, a entrada da página
  // não desloca nada (só a opacidade continua).
  return (
    <MotionConfig reducedMotion="user">
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="settings-page">
      {/* h2, não h1: o cabeçalho do portal já tem o h1 com o título da página. */}
      <header className="settings-header">
        <div className="header-left">
          <h2>Configurações do sistema</h2>
          <p>Personalize as configurações do LAINES conforme suas necessidades</p>
          <span className="settings-meta">
            {lastSavedLabel}
            {hasUnsavedChanges ? ' - Alterações pendentes' : ''}
          </span>
        </div>

        <div className="header-actions">
          <button
            type="button"
            onClick={handleReset}
            className="action-btn secondary"
            disabled={isSaving || isLoadingSettings || !canManageSettings}
            title={!canManageSettings ? 'Seu perfil possui somente leitura em configurações.' : undefined}
          >
            <RefreshCw size={18} />
            Restaurar padrão
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="action-btn primary"
            disabled={isSaving || isLoadingSettings || !hasUnsavedChanges || !canManageSettings}
            title={!canManageSettings ? 'Seu perfil possui somente leitura em configurações.' : undefined}
          >
            {isSaving ? (
              <>
                <RefreshCw className="spinner" size={18} />
                Salvando...
              </>
            ) : (
              <>
                <Save size={18} />
                Salvar Alterações
              </>
            )}
          </button>
        </div>
      </header>

      {saveMessage && (
        <div className={`status-message ${saveMessage.type}`} role={saveMessage.type === 'error' ? 'alert' : 'status'}>
          {saveMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{saveMessage.text}</span>
        </div>
      )}
      {isLoadingSettings && (
        <div className="status-message info" role="status">
          <RefreshCw size={18} className="spinner" />
          <span>Carregando configurações persistidas...</span>
        </div>
      )}
      {!isLoadingSettings && !canManageSettings && (
        <div className="status-message info" role="status" aria-live="polite">
          <AlertCircle size={18} />
          <span>Seu perfil possui acesso somente leitura nesta área.</span>
        </div>
      )}

      <div className="settings-container">
        <div className="settings-sidebar">
          <div className="sidebar-header">
            <SettingsIcon size={24} />
            <h3>Configurações</h3>
          </div>

          {/* aria-current anuncia a seção aberta; na tela, fundo claro e o
              traço azul (span, porque div não cabe dentro de button). */}
          <nav className="sidebar-nav" aria-label="Seções das configurações">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`sidebar-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                aria-current={activeTab === tab.id ? 'true' : undefined}
              >
                <span className="nav-icon">{tab.icon}</span>
                <span className="nav-label">{tab.label}</span>
                {activeTab === tab.id && <span className="nav-indicator" aria-hidden="true" />}
              </button>
            ))}
          </nav>
        </div>

        <div className="settings-content">
          <SettingsTabContent
            activeTab={activeTab}
            settings={settings}
            updateSetting={updateSetting}
            readOnly={!canManageSettings}
          />
        </div>
      </div>
    </motion.div>
    </MotionConfig>
  );
};

export default SettingsPage;
