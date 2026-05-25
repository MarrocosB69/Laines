import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';
import { getAccessToken, subscribeAuthSync } from './sessionToken';

const listenersByEvent = new Map();
let socket = null;
let authSyncUnsubscribe = null;

const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const resolveRealtimeEndpoint = () => {
  const baseUrl = normalizeBaseUrl(API_BASE_URL);
  const fallbackOrigin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost:4000';

  try {
    const resolvedUrl = new URL(baseUrl || fallbackOrigin, fallbackOrigin);
    const proxyPath = resolvedUrl.pathname.replace(/\/+$/, '');
    resolvedUrl.pathname = '';
    resolvedUrl.search = '';
    resolvedUrl.hash = '';

    return {
      url: resolvedUrl.toString().replace(/\/+$/, ''),
      path: `${proxyPath}/socket.io`.replace(/\/{2,}/g, '/')
    };
  } catch {
    return {
      url: baseUrl || fallbackOrigin,
      path: '/socket.io'
    };
  }
};

const countListeners = () => {
  let total = 0;
  listenersByEvent.forEach((bucket) => {
    total += bucket.size;
  });
  return total;
};

const dispatchEvent = (eventName, payload) => {
  const bucket = listenersByEvent.get(eventName);
  if (!bucket || bucket.size === 0) return;
  [...bucket].forEach((listener) => {
    try {
      listener(payload);
    } catch {
      // Falha de listener nao deve interromper outros consumidores.
    }
  });
};

const ensureSocket = () => {
  if (socket) return socket;

  const endpoint = resolveRealtimeEndpoint();
  socket = io(endpoint.url, {
    autoConnect: false,
    withCredentials: true,
    path: endpoint.path,
    transports: ['websocket'],
    timeout: 10000,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  });

  socket.onAny((eventName, payload) => {
    dispatchEvent(String(eventName || ''), payload);
  });

  return socket;
};

const connectSocketIfNeeded = () => {
  if (countListeners() === 0) return;

  const token = getAccessToken();
  if (!token) {
    if (socket?.connected) {
      socket.disconnect();
    }
    return;
  }

  const activeSocket = ensureSocket();
  activeSocket.auth = { token: `Bearer ${token}` };
  if (!activeSocket.connected && !activeSocket.active) {
    activeSocket.connect();
  }
};

const disconnectSocketIfIdle = () => {
  if (countListeners() > 0) return;
  if (socket?.connected || socket?.active) {
    socket.disconnect();
  }
};

const ensureAuthSyncSubscription = () => {
  if (authSyncUnsubscribe) return;
  authSyncUnsubscribe = subscribeAuthSync(({ type }) => {
    if (type === 'logout' || type === 'expired') {
      if (socket?.connected || socket?.active) {
        socket.disconnect();
      }
      return;
    }
    connectSocketIfNeeded();
  });
};

export const subscribeRealtimeEvent = (eventName, listener) => {
  const normalizedEvent = String(eventName || '').trim();
  if (!normalizedEvent || typeof listener !== 'function') {
    return () => {};
  }

  if (!listenersByEvent.has(normalizedEvent)) {
    listenersByEvent.set(normalizedEvent, new Set());
  }
  listenersByEvent.get(normalizedEvent).add(listener);

  ensureAuthSyncSubscription();
  connectSocketIfNeeded();

  return () => {
    const bucket = listenersByEvent.get(normalizedEvent);
    if (!bucket) return;
    bucket.delete(listener);
    if (bucket.size === 0) {
      listenersByEvent.delete(normalizedEvent);
    }
    disconnectSocketIfIdle();
  };
};

export const reconnectRealtime = () => {
  connectSocketIfNeeded();
};

export const disconnectRealtime = () => {
  if (socket?.connected || socket?.active) {
    socket.disconnect();
  }
};
