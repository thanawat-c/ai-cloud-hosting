import { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '../api/client';

const WorkspaceContext = createContext(null);

export const WorkspaceProvider = ({ children }) => {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    return localStorage.getItem('ach_active_workspace_id') || 'personal';
  });
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = async () => {
    try {
      const res = await apiFetch('/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data || []);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchWorkspaces, 0);
    return () => clearTimeout(timer);
  }, []);

  const switchWorkspace = (id) => {
    setActiveWorkspaceId(id);
    localStorage.setItem('ach_active_workspace_id', id);
    const target = workspaces.find((w) => w.id === id);
    toast.success(`Switched to ${target?.name || id}`);
    // Trigger global event so active pages refresh their data
    window.dispatchEvent(new CustomEvent('workspace-changed', { detail: { workspaceId: id } }));
  };

  const currentWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || {
    id: activeWorkspaceId,
    name: activeWorkspaceId === 'personal' ? 'Personal (Pro)' : 'Engineering Team',
    type: activeWorkspaceId === 'personal' ? 'personal' : 'team',
    plan: 'Pro',
    color: activeWorkspaceId === 'personal' ? 'emerald' : 'purple',
    deployments_count: 0,
    databases_count: 0,
    active_containers: 0,
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspaceId,
        currentWorkspace,
        switchWorkspace,
        refreshWorkspaces: fetchWorkspaces,
        loading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
};
