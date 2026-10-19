export const API_BASE_URL = 'http://localhost:8080/api';

export const getActiveWorkspaceId = () => {
  return localStorage.getItem('ach_active_workspace_id') || 'personal';
};

/**
 * apiFetch wraps fetch to automatically inject the X-Workspace-Id header
 * ensuring multi-tenancy isolation for all requests.
 */
export const apiFetch = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const workspaceId = getActiveWorkspaceId();

  const headers = {
    'X-Workspace-Id': workspaceId,
    ...(options.headers || {}),
  };

  return fetch(url, { ...options, headers });
};
