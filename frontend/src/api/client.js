export const API_BASE_URL = 'http://localhost:8080/api';

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
