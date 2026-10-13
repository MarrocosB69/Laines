export const SETTINGS_AUDIT_ACTION = 'settings_upsert';
export const SETTINGS_AUDIT_ENTITY = 'admin_settings';
export const SETTINGS_AUDIT_SCOPE = 'admin_console';
export const SETTINGS_ALLOWED_ROLES = new Set(['admin', 'coordenacao']);

export const DEFAULT_SETTINGS = Object.freeze({
  name: 'Coordenação Geral',
  email: 'coordenacao@laineslab.org',
  phone: '(11) 99999-9999',
  darkMode: false,
  language: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  dateFormat: 'DD/MM/YYYY',
  emailNotifications: true,
  pushNotifications: true,
  weeklyReports: true,
  systemAlerts: true,
  twoFactorAuth: false,
  sessionTimeout: 30,
  showSensitiveData: false,
  compactMode: false,
  highContrast: false,
  animationsEnabled: true
});

const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS);

export const normalizeSettingsPayload = (input) => {
  const source = (input && typeof input === 'object' && !Array.isArray(input))
    ? input
    : {};

  const picked = SETTINGS_KEYS.reduce((acc, key) => {
    acc[key] = source[key];
    return acc;
  }, {});

  const merged = { ...DEFAULT_SETTINGS, ...picked };
  return {
    ...merged,
    sessionTimeout: Number.isFinite(Number(merged.sessionTimeout))
      ? Number(merged.sessionTimeout)
      : DEFAULT_SETTINGS.sessionTimeout
  };
};
