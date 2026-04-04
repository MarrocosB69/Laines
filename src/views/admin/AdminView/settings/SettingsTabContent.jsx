import React from 'react';
import {
  Calendar,
  Clock,
  Globe,
  Mail,
  Moon,
  Shield,
  Smartphone,
  Sun,
  User
} from 'lucide-react';
import ToggleSetting from './ToggleSetting';

const SettingsTabContent = ({
  activeTab,
  settings,
  updateSetting,
  readOnly = false
}) => {
  const handleUpdate = (key, value) => {
    if (readOnly) return;
    updateSetting(key, value);
  };

  switch (activeTab) {
    case 'profile':
      return (
        <div className="settings-section">
          <h3>Informações do perfil</h3>
          <p className="section-description">Gerencie dados básicos de conta.</p>
          <div className="settings-grid">
            <div className="setting-item">
              <label className="setting-label"><User size={16} />Nome completo</label>
              <input
                type="text"
                value={settings.name}
                onChange={(event) => handleUpdate('name', event.target.value)}
                className="setting-input"
                disabled={readOnly}
              />
            </div>
            <div className="setting-item">
              <label className="setting-label"><Mail size={16} />E-mail institucional</label>
              <input
                type="email"
                value={settings.email}
                onChange={(event) => handleUpdate('email', event.target.value)}
                className="setting-input"
                disabled={readOnly}
              />
            </div>
            <div className="setting-item">
              <label className="setting-label"><Smartphone size={16} />Telefone</label>
              <input
                type="tel"
                value={settings.phone}
                onChange={(event) => handleUpdate('phone', event.target.value)}
                className="setting-input"
                disabled={readOnly}
              />
            </div>
          </div>
        </div>
      );

    case 'system':
      return (
        <div className="settings-section">
          <h3>Sistema</h3>
          <p className="section-description">Parâmetros gerais da plataforma.</p>
          <div className="settings-grid">
            <div className="setting-item">
              <label className="setting-label"><Globe size={16} />Idioma</label>
              <select
                value={settings.language}
                onChange={(event) => handleUpdate('language', event.target.value)}
                className="setting-select"
                disabled={readOnly}
              >
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en-US">English (US)</option>
                <option value="es-ES">Espanhol</option>
              </select>
            </div>
            <div className="setting-item">
              <label className="setting-label"><Clock size={16} />Fuso horário</label>
              <select
                value={settings.timezone}
                onChange={(event) => handleUpdate('timezone', event.target.value)}
                className="setting-select"
                disabled={readOnly}
              >
                <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                <option value="America/New_York">New York (GMT-5)</option>
                <option value="Europe/London">London (GMT+0)</option>
              </select>
            </div>
            <div className="setting-item">
              <label className="setting-label"><Calendar size={16} />Formato de data</label>
              <select
                value={settings.dateFormat}
                onChange={(event) => handleUpdate('dateFormat', event.target.value)}
                className="setting-select"
                disabled={readOnly}
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <div className="setting-item">
              <label className="setting-label">{settings.darkMode ? <Moon size={16} /> : <Sun size={16} />}Tema</label>
              <div className="toggle-group">
                <button
                  type="button"
                  onClick={() => handleUpdate('darkMode', false)}
                  className={`toggle-option ${!settings.darkMode ? 'active' : ''}`}
                  disabled={readOnly}
                >
                  <Sun size={14} /> Claro
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdate('darkMode', true)}
                  className={`toggle-option ${settings.darkMode ? 'active' : ''}`}
                  disabled={readOnly}
                >
                  <Moon size={14} /> Escuro
                </button>
              </div>
            </div>
          </div>
        </div>
      );

    case 'notifications':
      return (
        <div className="settings-section">
          <h3>Notificações</h3>
          <p className="section-description">Controle de avisos e alertas.</p>
          <div className="settings-list">
            <ToggleSetting
              title="Notificações por e-mail"
              description="Receber atualizações importantes por e-mail."
              checked={settings.emailNotifications}
              onChange={(checked) => handleUpdate('emailNotifications', checked)}
              disabled={readOnly}
            />
            <ToggleSetting
              title="Notificações push"
              description="Receber avisos em tempo real no navegador."
              checked={settings.pushNotifications}
              onChange={(checked) => handleUpdate('pushNotifications', checked)}
              disabled={readOnly}
            />
            <ToggleSetting
              title="Relatório semanal"
              description="Receber consolidado semanal de operação."
              checked={settings.weeklyReports}
              onChange={(checked) => handleUpdate('weeklyReports', checked)}
              disabled={readOnly}
            />
            <ToggleSetting
              title="Alertas de sistema"
              description="Receber avisos de incidentes e manutenção."
              checked={settings.systemAlerts}
              onChange={(checked) => handleUpdate('systemAlerts', checked)}
              disabled={readOnly}
            />
          </div>
        </div>
      );

    case 'security':
      return (
        <div className="settings-section">
          <h3>Segurança</h3>
          <p className="section-description">Controles de acesso e privacidade.</p>
          <div className="settings-list">
            <ToggleSetting
              title="Autenticação em dois fatores"
              description="Ativa camada adicional de verificação."
              checked={settings.twoFactorAuth}
              onChange={(checked) => handleUpdate('twoFactorAuth', checked)}
              disabled={readOnly}
            />
            <div className="setting-item">
              <label className="setting-label"><Clock size={16} />Timeout de sessão</label>
              <div className="range-setting">
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={settings.sessionTimeout}
                  onChange={(event) => handleUpdate('sessionTimeout', Number(event.target.value))}
                  className="range-input"
                  disabled={readOnly}
                />
                <span className="range-value">{settings.sessionTimeout} min</span>
              </div>
            </div>
            <ToggleSetting
              title="Exibir dados sensíveis"
              description="Permite exibição de dados confidenciais em relatórios."
              checked={settings.showSensitiveData}
              onChange={(checked) => handleUpdate('showSensitiveData', checked)}
              disabled={readOnly}
            />
          </div>
        </div>
      );

    case 'appearance':
      return (
        <div className="settings-section">
          <h3>Aparência</h3>
          <p className="section-description">Preferências de interface.</p>
          <div className="settings-list">
            <ToggleSetting
              title="Modo compacto"
              description="Reduz espaços para aumentar densidade de informação."
              checked={settings.compactMode}
              onChange={(checked) => handleUpdate('compactMode', checked)}
              disabled={readOnly}
            />
            <ToggleSetting
              title="Alto contraste"
              description="Aumenta contraste para leitura em ambientes desafiadores."
              checked={settings.highContrast}
              onChange={(checked) => handleUpdate('highContrast', checked)}
              disabled={readOnly}
            />
            <ToggleSetting
              title="Animações"
              description="Habilita transições e efeitos visuais."
              checked={settings.animationsEnabled}
              onChange={(checked) => handleUpdate('animationsEnabled', checked)}
              disabled={readOnly}
            />
          </div>
        </div>
      );

    default:
      return null;
  }
};

export default SettingsTabContent;
