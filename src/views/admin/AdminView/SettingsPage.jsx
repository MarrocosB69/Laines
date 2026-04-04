import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
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

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      setIsLoadingSettings(true);
      try {
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
        if (!active) return;
        setSettings(normalized);
        setSavedSnapshot(normalized);
        if (latest) {
          setLastSavedMeta({
            at: latest.createdAt || null,
            by: latest?.actor?.name || latest?.actor?.email || ''
          });
        }
      } catch (error) {
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
  }, [notify]);

  const persistSettings = useCallback(async (nextSettings, mode = 'manual') => {
    if (!ensureCanManageSettings('Salvar configurações')) return false;

    const normalized = normalizeSettingsPayload(nextSettings);
    const changedKeys = Object.keys(DEFAULT_SETTINGS)
      .filter((key) => normalized[key] !== savedSnapshot[key]);

    setIsSaving(true);
    try {
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

      setSettings(normalized);
      setSavedSnapshot(normalized);
      setLastSavedMeta({
        at: new Date().toISOString(),
        by: user?.name || user?.email || ''
      });
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
  }, [ensureCanManageSettings, notify, savedSnapshot, user?.email, user?.name]);

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

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="settings-page">
      <div className="settings-header">
        <div className="header-left">
          <h1>Configurações do sistema</h1>
          <p>Personalize as configurações do LAINES conforme suas necessidades</p>
          <span className="settings-meta">
            {lastSavedLabel}
            {hasUnsavedChanges ? ' - Alterações pendentes' : ''}
          </span>
        </div>

        <div className="header-actions">
          <button
            onClick={handleReset}
            className="action-btn secondary"
            disabled={isSaving || isLoadingSettings || !canManageSettings}
            title={!canManageSettings ? 'Seu perfil possui somente leitura em configurações.' : undefined}
          >
            <RefreshCw size={18} />
            Restaurar padrão
          </button>
          <button
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
      </div>

      {saveMessage && (
        <div className={`status-message ${saveMessage.type}`}>
          {saveMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{saveMessage.text}</span>
        </div>
      )}
      {isLoadingSettings && (
        <div className="status-message info">
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

          <nav className="sidebar-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`sidebar-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              >
                <span className="nav-icon">{tab.icon}</span>
                <span className="nav-label">{tab.label}</span>
                {activeTab === tab.id && <div className="nav-indicator" />}
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
  );
};

export default SettingsPage;
