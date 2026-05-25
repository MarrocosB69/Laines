export const SETTINGS_SCOPE_ADMIN_CONSOLE = 'admin_console';
export const SETTINGS_AUDIT_ACTION = 'settings_upsert';
export const SETTINGS_AUDIT_ENTITY = 'admin_settings';

export type AdminConsoleSettings = {
  name: string;
  email: string;
  phone: string;
  darkMode: boolean;
  language: string;
  timezone: string;
  dateFormat: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyReports: boolean;
  systemAlerts: boolean;
  twoFactorAuth: boolean;
  sessionTimeout: number;
  showSensitiveData: boolean;
  compactMode: boolean;
  highContrast: boolean;
  animationsEnabled: boolean;
};

export const ADMIN_CONSOLE_DEFAULT_SETTINGS: AdminConsoleSettings = Object.freeze({
  name: 'Coordenacao Geral',
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

const LANGUAGE_OPTIONS = new Set(['pt-BR', 'en-US', 'es-ES']);
const TIMEZONE_OPTIONS = new Set(['America/Sao_Paulo', 'America/New_York', 'Europe/London']);
const DATE_FORMAT_OPTIONS = new Set(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']);

const asString = (value: unknown, fallback: string) => {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
};

const asBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
};

const asSessionTimeout = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric / 5) * 5;
  return Math.min(Math.max(rounded, 5), 120);
};

const pickAllowed = (value: string, allowed: Set<string>, fallback: string) => (
  allowed.has(value) ? value : fallback
);

export const normalizeAdminConsoleSettings = (
  input?: Record<string, unknown> | null
): AdminConsoleSettings => {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    name: asString(source.name, ADMIN_CONSOLE_DEFAULT_SETTINGS.name),
    email: asString(source.email, ADMIN_CONSOLE_DEFAULT_SETTINGS.email).toLowerCase(),
    phone: asString(source.phone, ADMIN_CONSOLE_DEFAULT_SETTINGS.phone),
    darkMode: asBoolean(source.darkMode, ADMIN_CONSOLE_DEFAULT_SETTINGS.darkMode),
    language: pickAllowed(
      asString(source.language, ADMIN_CONSOLE_DEFAULT_SETTINGS.language),
      LANGUAGE_OPTIONS,
      ADMIN_CONSOLE_DEFAULT_SETTINGS.language
    ),
    timezone: pickAllowed(
      asString(source.timezone, ADMIN_CONSOLE_DEFAULT_SETTINGS.timezone),
      TIMEZONE_OPTIONS,
      ADMIN_CONSOLE_DEFAULT_SETTINGS.timezone
    ),
    dateFormat: pickAllowed(
      asString(source.dateFormat, ADMIN_CONSOLE_DEFAULT_SETTINGS.dateFormat),
      DATE_FORMAT_OPTIONS,
      ADMIN_CONSOLE_DEFAULT_SETTINGS.dateFormat
    ),
    emailNotifications: asBoolean(source.emailNotifications, ADMIN_CONSOLE_DEFAULT_SETTINGS.emailNotifications),
    pushNotifications: asBoolean(source.pushNotifications, ADMIN_CONSOLE_DEFAULT_SETTINGS.pushNotifications),
    weeklyReports: asBoolean(source.weeklyReports, ADMIN_CONSOLE_DEFAULT_SETTINGS.weeklyReports),
    systemAlerts: asBoolean(source.systemAlerts, ADMIN_CONSOLE_DEFAULT_SETTINGS.systemAlerts),
    twoFactorAuth: asBoolean(source.twoFactorAuth, ADMIN_CONSOLE_DEFAULT_SETTINGS.twoFactorAuth),
    sessionTimeout: asSessionTimeout(source.sessionTimeout, ADMIN_CONSOLE_DEFAULT_SETTINGS.sessionTimeout),
    showSensitiveData: asBoolean(source.showSensitiveData, ADMIN_CONSOLE_DEFAULT_SETTINGS.showSensitiveData),
    compactMode: asBoolean(source.compactMode, ADMIN_CONSOLE_DEFAULT_SETTINGS.compactMode),
    highContrast: asBoolean(source.highContrast, ADMIN_CONSOLE_DEFAULT_SETTINGS.highContrast),
    animationsEnabled: asBoolean(source.animationsEnabled, ADMIN_CONSOLE_DEFAULT_SETTINGS.animationsEnabled)
  };
};

export const ADMIN_CONSOLE_SETTINGS_KEYS = Object.keys(ADMIN_CONSOLE_DEFAULT_SETTINGS) as Array<keyof AdminConsoleSettings>;
