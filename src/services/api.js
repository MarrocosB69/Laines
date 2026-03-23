import axios from 'axios';
import {
  broadcastAuthSync,
  clearAccessToken,
  getAccessToken,
  isNewAuthFlowEnabled,
  setAccessToken
} from './sessionToken';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 20000);
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

export const getApiErrorMessage = (error, fallback = 'Não foi possível concluir a operação.') => {
  const response = error?.response;
  if (!response) {
    if (error?.code === 'ECONNABORTED') {
      return 'Tempo limite excedido. Tente novamente.';
    }
    return 'Não foi possível conectar ao servidor.';
  }

  const message = readPayloadMessage(response.data);
  if (message) return message;
  if (typeof error?.message === 'string' && error.message.trim()) return error.message;
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
