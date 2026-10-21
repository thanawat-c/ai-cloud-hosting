export const API_BASE_URL = (() => {
  if (import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }
  if (import.meta.env?.VITE_SERVER_URL) {
    return `${import.meta.env.VITE_SERVER_URL.replace(/\/+$/, '')}/api`;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:8080/api';
})();

export const getApiUrl = (endpoint = '') => {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
};

export const getActiveWorkspaceId = () => {
  return localStorage.getItem('ach_active_workspace_id') || 'personal';
};

export const getAuthToken = () => {
  return localStorage.getItem('ach_auth_token') || null;
};

/**
 * apiFetch wraps fetch to automatically inject the X-Workspace-Id and Authorization Bearer headers
 * ensuring multi-tenancy isolation and authenticated access for all requests.
 */
export const apiFetch = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const workspaceId = getActiveWorkspaceId();
  const token = getAuthToken();

  const headers = {
    'X-Workspace-Id': workspaceId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  return fetch(url, { ...options, headers });
};
