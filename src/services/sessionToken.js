const LEGACY_SESSION_TOKEN_KEY = 'laines_session_token_v2';
const LEGACY_LOCAL_STORAGE_TOKEN_KEY = 'laines_token';
const AUTH_SYNC_STORAGE_KEY = 'laines_auth_sync';
const AUTH_SYNC_EVENT = 'laines:auth-sync';
const AUTH_SYNC_CHANNEL = 'laines-auth-sync';
const TOKEN_EXPIRY_SKEW_MS = 15 * 1000;
const NEW_AUTH_FLOW_ENABLED = String(import.meta.env.VITE_NEW_AUTH_FLOW || 'true').trim().toLowerCase() === 'true';

let memoryToken = '';
let memoryTokenExpiresAt = null;
let bootstrapped = false;
let channelRef = null;

const isBrowser = () => (
  typeof window !== 'undefined'
  && typeof window.sessionStorage !== 'undefined'
);

const normalizeToken = (value) => {
  if (typeof value !== 'string') return '';
  const token = value.trim();
  return token.length > 0 ? token : '';
};

const decodeBase64Url = (input) => {
  if (typeof input !== 'string' || !input) return '';
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const missingPadding = padded.length % 4;
  const normalized = missingPadding ? `${padded}${'='.repeat(4 - missingPadding)}` : padded;
  try {
    if (typeof atob === 'function') {
      return atob(normalized);
    }
  } catch {
    return '';
  }
  return '';
};

const readTokenExpiry = (token) => {
  const normalized = normalizeToken(token);
  if (!normalized) return null;
  const parts = normalized.split('.');
  if (parts.length < 2) return null;
  try {
    const payloadJson = decodeBase64Url(parts[1]);
    if (!payloadJson) return null;
    const payload = JSON.parse(payloadJson);
    const expSeconds = Number(payload?.exp);
    if (!Number.isFinite(expSeconds)) return null;
    return expSeconds * 1000;
  } catch {
    return null;
  }
};

const hasExpired = (expiresAt) => (
  Number.isFinite(Number(expiresAt))
  && Number(expiresAt) <= (Date.now() + TOKEN_EXPIRY_SKEW_MS)
);

const clearLegacyLocalStorageToken = () => {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(LEGACY_LOCAL_STORAGE_TOKEN_KEY);
  } catch {
    // Ignora ambiente sem permissao de localStorage.
  }
};

const clearLegacySessionStorageToken = () => {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
  } catch {
    // Ignora ambiente sem permissao de sessionStorage.
  }
};

const readLegacySessionStorageToken = () => {
  if (!isBrowser()) return '';
  try {
    const raw = window.sessionStorage.getItem(LEGACY_SESSION_TOKEN_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return normalizeToken(parsed?.token);
  } catch {
    return '';
  }
};

const writeLegacySessionStorageToken = (token) => {
  if (!isBrowser() || NEW_AUTH_FLOW_ENABLED) return;
  const normalized = normalizeToken(token);
  if (!normalized) {
    clearLegacySessionStorageToken();
    return;
  }

  window.sessionStorage.setItem(
    LEGACY_SESSION_TOKEN_KEY,
    JSON.stringify({
      token: normalized,
      expiresAt: readTokenExpiry(normalized),
      storedAt: new Date().toISOString()
    })
  );
};

const clearAllTokenState = () => {
  memoryToken = '';
  memoryTokenExpiresAt = null;
  clearLegacyLocalStorageToken();
  clearLegacySessionStorageToken();
};

const bootstrapTokenState = () => {
  if (bootstrapped) return;
  bootstrapped = true;

  clearLegacyLocalStorageToken();

  if (NEW_AUTH_FLOW_ENABLED) {
    // Novo fluxo: access token exclusivamente em memória.
    clearLegacySessionStorageToken();
    return;
  }

  const storedToken = readLegacySessionStorageToken();
  if (!storedToken) return;
  const expiresAt = readTokenExpiry(storedToken);
  if (hasExpired(expiresAt)) {
    clearAllTokenState();
    return;
  }
  memoryToken = storedToken;
  memoryTokenExpiresAt = expiresAt;
};

const resolveChannel = () => {
  if (!isBrowser()) return null;
  if (channelRef) return channelRef;
  if (typeof window.BroadcastChannel !== 'function') return null;
  try {
    channelRef = new window.BroadcastChannel(AUTH_SYNC_CHANNEL);
    return channelRef;
  } catch {
    channelRef = null;
    return null;
  }
};

const emitSameTabSyncEvent = (payload) => {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(AUTH_SYNC_EVENT, { detail: payload }));
};

export const isNewAuthFlowEnabled = () => NEW_AUTH_FLOW_ENABLED;

export const setAccessToken = (token) => {
  bootstrapTokenState();
  const normalized = normalizeToken(token);
  if (!normalized) {
    clearAllTokenState();
    return null;
  }

  const expiresAt = readTokenExpiry(normalized);
  memoryToken = normalized;
  memoryTokenExpiresAt = expiresAt;

  if (hasExpired(expiresAt)) {
    clearAllTokenState();
    return null;
  }

  writeLegacySessionStorageToken(normalized);
  return normalized;
};

export const getAccessToken = () => {
  bootstrapTokenState();
  if (!memoryToken) return null;
  if (hasExpired(memoryTokenExpiresAt)) {
    clearAllTokenState();
    return null;
  }
  return memoryToken;
};

export const hasAccessToken = () => Boolean(getAccessToken());

export const clearAccessToken = () => {
  clearAllTokenState();
};

export const broadcastAuthSync = (type) => {
  if (!isBrowser()) return;
  const normalizedType = String(type || '').trim().toLowerCase();
  if (!normalizedType) return;
  const payload = {
    type: normalizedType,
    at: new Date().toISOString()
  };

  const channel = resolveChannel();
  if (channel) {
    try {
      channel.postMessage(payload);
    } catch {
      // Sem impacto funcional: fallback via storage event.
    }
  }

  try {
    window.localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(payload));
    window.localStorage.removeItem(AUTH_SYNC_STORAGE_KEY);
  } catch {
    // Fallback segue via event local.
  }

  emitSameTabSyncEvent(payload);
};

export const subscribeAuthSync = (handler) => {
  if (!isBrowser() || typeof handler !== 'function') {
    return () => {};
  }

  const notify = (payload) => {
    const type = String(payload?.type || '').trim().toLowerCase();
    if (!type) return;
    handler({
      type,
      at: payload?.at || new Date().toISOString()
    });
  };

  const onStorage = (event) => {
    if (event.key !== AUTH_SYNC_STORAGE_KEY || !event.newValue) return;
    try {
      notify(JSON.parse(event.newValue));
    } catch {
      // Ignora payload invalido.
    }
  };

  const onWindowEvent = (event) => {
    notify(event?.detail || {});
  };

  const channel = resolveChannel();
  const onChannelMessage = (event) => notify(event?.data || {});

  window.addEventListener('storage', onStorage);
  window.addEventListener(AUTH_SYNC_EVENT, onWindowEvent);
  if (channel) {
    channel.addEventListener('message', onChannelMessage);
  }

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(AUTH_SYNC_EVENT, onWindowEvent);
    if (channel) {
      channel.removeEventListener('message', onChannelMessage);
    }
  };
};
