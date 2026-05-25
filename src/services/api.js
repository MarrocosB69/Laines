import axios from 'axios';
import {
  broadcastAuthSync,
  clearAccessToken,
  getAccessToken,
  isNewAuthFlowEnabled,
  setAccessToken
} from './sessionToken';

const configuredApiBaseUrl = String(import.meta.env.VITE_API_URL || '').trim();
if (import.meta.env.MODE === 'production' && !configuredApiBaseUrl) {
  throw new Error('[LAINES] VITE_API_URL não definida. Configure a variável antes do build de produção.');
}
const API_BASE_URL = configuredApiBaseUrl || 'http://localhost:4000';
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);
export const AUTH_EXPIRED_EVENT = 'laines:auth-expired';

let inFlightRefresh = null;

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

const normalizeTextValue = (value) => (
  typeof value === 'string'
    ? value.replace(/^\uFEFF/, '').normalize('NFC')
    : value
);

const normalizePayloadText = (value, seen = new WeakSet()) => {
  if (typeof value === 'string') return normalizeTextValue(value);
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => normalizePayloadText(item, seen));

  if (typeof value !== 'object') return value;

  if (
    (typeof FormData !== 'undefined' && value instanceof FormData)
    || (typeof Blob !== 'undefined' && value instanceof Blob)
    || (typeof ArrayBuffer !== 'undefined' && (value instanceof ArrayBuffer || ArrayBuffer.isView(value)))
    || value instanceof Date
    || value instanceof URLSearchParams
  ) {
    return value;
  }

  if (!isPlainObject(value)) return value;
  if (seen.has(value)) return value;
  seen.add(value);

  Object.entries(value).forEach(([key, currentValue]) => {
    value[key] = normalizePayloadText(currentValue, seen);
  });
  return value;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: Number.isFinite(API_TIMEOUT_MS) && API_TIMEOUT_MS > 0 ? API_TIMEOUT_MS : 20000,
  withCredentials: true
});

const markAuthExpired = (eventType = 'expired') => {
  clearAccessToken();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
  broadcastAuthSync(eventType);
};

const shouldSkipRefresh = (config = {}) => {
  if (!isNewAuthFlowEnabled()) return true;
  if (config?.skipAuthRefresh) return true;
  const requestUrl = String(config?.url || '').toLowerCase();
  return requestUrl.includes('/auth/login')
    || requestUrl.includes('/auth/refresh')
    || requestUrl.includes('/auth/logout');
};

const doRefresh = async () => {
  const headers = { 'x-auth-flow': 'v2' };
  const { data } = await api.post('/auth/refresh', undefined, {
    headers,
    skipAuthRefresh: true
  });
  const refreshedToken = String(data?.accessToken || '').trim();
  if (!refreshedToken) {
    throw new Error('Resposta de refresh sem access token.');
  }
  setAccessToken(refreshedToken);
  return refreshedToken;
};

const refreshSingleFlight = async () => {
  if (!inFlightRefresh) {
    inFlightRefresh = doRefresh()
      .catch((error) => {
        throw error;
      })
      .finally(() => {
        inFlightRefresh = null;
      });
  }
  return inFlightRefresh;
};

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.params) {
    config.params = normalizePayloadText(config.params);
  }

  if (config.data) {
    config.data = normalizePayloadText(config.data);
  }

  return config;
});

const readPayloadMessage = (payload) => {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (Array.isArray(payload.message)) {
    return payload.message.map((item) => String(item)).join(' ');
  }
  if (typeof payload.message === 'string') return payload.message;
  if (typeof payload.error === 'string') return payload.error;
  return '';
};

// Status codes with a definitive friendly message. Omit 400/401/422 — those
// fall through to the backend message or the caller's fallback instead.
const HTTP_STATUS_MESSAGES = {
  403: 'Você não tem permissão para realizar esta ação.',
  404: 'Registro não encontrado.',
  408: 'Tempo limite excedido. Tente novamente.',
  409: 'Este registro já existe ou conflita com dados existentes.',
  413: 'O arquivo enviado excede o tamanho permitido.',
  429: 'Muitas tentativas. Aguarde alguns instantes antes de tentar novamente.',
  500: 'Ocorreu um erro interno. Tente novamente em instantes.',
  502: 'Serviço temporariamente indisponível.',
  503: 'Serviço em manutenção. Tente novamente em breve.',
  504: 'O servidor demorou para responder. Tente novamente.',
};

// NestJS/HTTP default strings that should never reach the user
const TECHNICAL_MESSAGE_RE = /^(internal server error|unauthorized|forbidden(?: resource)?|not found|cannot (?:get|post|put|patch|delete) .+|bad request|unprocessable entity|conflict|too many requests|bad gateway|service unavailable|gateway timeout)$/i;

const sanitizeBackendMessage = (raw) => {
  if (!raw) return null;
  const text = String(raw).trim();
  if (!text || text.length > 280) return null; // empty or suspiciously long
  if (TECHNICAL_MESSAGE_RE.test(text)) return null;
  return text;
};

export const getApiErrorMessage = (error, fallback = 'Não foi possível concluir a operação.') => {
  const response = error?.response;
  if (!response) {
    if (error?.code === 'ECONNABORTED') return 'Tempo limite excedido. Tente novamente.';
    return 'Não foi possível conectar ao servidor.';
  }

  const status = Number(response.status || 0);

  // Definitive friendly message for this status — always wins
  if (HTTP_STATUS_MESSAGES[status]) return HTTP_STATUS_MESSAGES[status];

  // For 400/422/401 and unmapped codes: try the backend message if it's user-readable
  const clean = sanitizeBackendMessage(readPayloadMessage(response.data));
  if (clean) return clean;

  // Catch-all for unmapped 5xx
  if (status >= 500) return 'Ocorreu um erro interno. Tente novamente em instantes.';

  return fallback;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = Number(error?.response?.status || 0);
    const originalRequest = error?.config || {};

    if (status !== 401) {
      return Promise.reject(error);
    }

    if (!isNewAuthFlowEnabled()) {
      if (getAccessToken()) {
        markAuthExpired('expired');
      }
      return Promise.reject(error);
    }

    if (shouldSkipRefresh(originalRequest) || originalRequest?._authRefreshTried) {
      const requestUrl = String(originalRequest?.url || '').toLowerCase();
      const isLoginRequest = requestUrl.includes('/auth/login');
      if (!isLoginRequest && getAccessToken()) {
        markAuthExpired('logout');
      }
      return Promise.reject(error);
    }

    originalRequest._authRefreshTried = true;
    try {
      const refreshedToken = await refreshSingleFlight();
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
      return api.request(originalRequest);
    } catch {
      markAuthExpired('logout');
      return Promise.reject(error);
    }
  }
);

export default api;
export { API_BASE_URL };
