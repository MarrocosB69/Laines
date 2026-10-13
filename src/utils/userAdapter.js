import { normalizeRole } from '../constants/roles.js';

const ensureString = (value) => (typeof value === 'string' ? value : '');

export const normalizeUserRecord = (rawUser) => {
  if (!rawUser || typeof rawUser !== 'object') return null;

  const id = ensureString(rawUser.id || rawUser.userId || rawUser.uid).trim();
  const name = ensureString(rawUser.name || rawUser.nome).trim();
  const email = ensureString(rawUser.email).trim();
  const role = normalizeRole(rawUser.role);
  const mustChangePassword = !!rawUser.mustChangePassword;
  const passwordChanged = typeof rawUser.passwordChanged === 'boolean'
    ? rawUser.passwordChanged
    : !mustChangePassword;

  return {
    ...Object.fromEntries(Object.entries(rawUser).filter(([key]) => !['passwordHash', 'tempPassword', 'temporaryPassword', 'hasTemporaryPassword'].includes(key))),
    id: id || undefined,
    uid: id || undefined,
    userId: id || undefined,
    name,
    nome: name,
    email,
    role,
    mustChangePassword,
    passwordChanged
  };
};

export const normalizeUserList = (users) => {
  if (!Array.isArray(users)) return [];
  return users
    .map((item) => normalizeUserRecord(item))
    .filter(Boolean);
};

export const getUserDisplayName = (user, fallback = 'Usuario') => {
  const normalized = normalizeUserRecord(user);
  if (!normalized) return fallback;
  return normalized.name || normalized.email || fallback;
};
