import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Server, Play, Box, X, Bell, BellRing, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '../context/WorkspaceContext';
import { apiFetch, API_BASE_URL } from '../api/client';
import {
  UniversalConfirmModal,
  DatabaseSnapshotModal,
  DeploymentReleasesModal,
  CustomDomainModal,
  WebSqlStudioModal,
  CreateDatabaseModal,
  BindDatabaseModal,
  RestoreDatabaseModal,
  EnvVariablesModal,
  ContainerLogsModal,
  ErrorDetailsModal,
  WebhookModal,
  LiveMetricsModal,
  ProjectSettingsModal,
  CreateVolumeModal,
} from '../components/modals';
import {
  DashboardSubnav,
  DeploymentTableRow,
  StorageSection,
} from '../components/dashboard';

// Extract short repository name, e.g. mock-api-server from git URL
const getShortAppName = (rawName, cleanName) => {
  const nameToParse = cleanName || rawName?.replace(/\s*\((Backend|Frontend)\)$/, '') || '';
  if (!nameToParse) return 'Unknown App';
  
  // Remove .git suffix
  let cleaned = nameToParse.replace(/\.git\/?$/, '');
  
  // Remove URL protocol and domain
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length > 0) {
      cleaned = parts[parts.length - 1]; // Use repository name
    }
  }
  return cleaned;
};

// Helper to get GitHub commit link
const getGitCommitUrl = (repoUrl, commitHash) => {
  if (!repoUrl || !commitHash) return null;
  const clean = repoUrl.replace(/\.git\/?$/, '').replace(/\s*\((Backend|Frontend)\)$/, '').trim();
  if (clean.includes('github.com')) {
    return `${clean}/commit/${commitHash}`;
  }
  return null;
};

// Calculate relative time ago, e.g., 'just now', '2m ago', '1h ago'
const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';

  const now = new Date();
  const diffSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffSeconds < 10) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
};

// Extract key error message / root cause from stack trace
const extractCrashRootCause = (logText) => {
  if (!logText) return 'No error details recorded';
  // eslint-disable-next-line no-control-regex
  const clean = logText.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.startsWith('Error:') || 
      line.startsWith('Error ') || 
      line.includes('PrismaClient') ||
      line.includes('Exception:') ||
      line.includes('panic:') ||
      line.includes('fatal:') ||
      line.includes('failed:') ||
      line.includes('connect ECONNREFUSED')
    ) {
      return line;
    }
  }
  return lines[0] || 'Unknown runtime error';
};

const DashboardHome = () => {
  const { activeWorkspaceId, refreshWorkspaces } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'storage' ? 'storage' : 'deployments';
  const [containers, setContainers] = useState([]);
  const [activeMenuId, setActiveMenuId] = useState(null);

  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (!e.target.closest('.dropdown-menu-container')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [currentLogs, setCurrentLogs] = useState('');
  const [logLoading, setLogLoading] = useState(false);
  const [activeContainerName, setActiveContainerName] = useState('');

  // Auto-refresh relative time every 10 seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  // Env Modal State
  const [envModalOpen, setEnvModalOpen] = useState(false);
  const [activeEnvContainerId, setActiveEnvContainerId] = useState('');
  const [activeEnvContainerName, setActiveEnvContainerName] = useState('');
  const [currentEnvText, setCurrentEnvText] = useState('');
  const [envSaving, setEnvSaving] = useState(false);
  const [envError, setEnvError] = useState('');
  const [envSuccess, setEnvSuccess] = useState('');

  // Error Modal State
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [activeErrorContainerName, setActiveErrorContainerName] = useState('');
  const [activeErrorDetails, setActiveErrorDetails] = useState('');
  const [dismissAlert, setDismissAlert] = useState(false);
  const [dismissDbAlert, setDismissDbAlert] = useState(false);

  // Managed Databases State
  const [databases, setDatabases] = useState([]);
  const [createDbModalOpen, setCreateDbModalOpen] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [creatingDb, setCreatingDb] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // SQL Studio State
  const [sqlModalOpen, setSqlModalOpen] = useState(false);
  const [activeSqlDb, setActiveSqlDb] = useState(null);
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResult, setSqlResult] = useState('');
  const [sqlTables, setSqlTables] = useState([]);
  const [runningSql, setRunningSql] = useState(false);

  // Bind Server State
  const [bindModalOpen, setBindModalOpen] = useState(false);
  const [activeBindDb, setActiveBindDb] = useState(null);
  const [selectedTargetContainer, setSelectedTargetContainer] = useState('');
  const [bindingServer, setBindingServer] = useState(false);

  // Backup & Restore State
  const [backingUpId, setBackingUpId] = useState(null);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [activeRestoreDb, setActiveRestoreDb] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState('');

  // Snapshots & Server Backups State
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [activeSnapshotDb, setActiveSnapshotDb] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [takingSnapshot, setTakingSnapshot] = useState(false);
  const [snapshotNote, setSnapshotNote] = useState('');
  const [confirmRestoreSnapshot, setConfirmRestoreSnapshot] = useState(null);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState(null);
  const [deletingSnapshotId, setDeletingSnapshotId] = useState(null);
  const [activeSnapshotTab, setActiveSnapshotTab] = useState('list'); // 'list' | 'upload'

  // Deployment Releases & Instant Rollback State
  const [releasesModalOpen, setReleasesModalOpen] = useState(false);
  const [activeReleasesContainer, setActiveReleasesContainer] = useState(null);
  const [releases, setReleases] = useState([]);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [confirmRollbackRelease, setConfirmRollbackRelease] = useState(null);
  const [rollingBackId, setRollingBackId] = useState(null);

  // Webhook State
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [activeWebhookContainer, setActiveWebhookContainer] = useState(null);
  const [pingingWebhook, setPingingWebhook] = useState(false);
  const [customPublicUrl, setCustomPublicUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ai_cloud_public_url') || '';
    }
    return '';
  });

  const handleUpdatePublicUrl = (url) => {
    setCustomPublicUrl(url);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_cloud_public_url', url);
    }
  };

  // Metrics Modal State
  const [metricsModalOpen, setMetricsModalOpen] = useState(false);
  const [metricsContainer, setMetricsContainer] = useState(null);
  const [metricsData, setMetricsData] = useState(null);

  const fetchMetrics = async (id) => {
    try {
      const res = await apiFetch(`/containers/${id}/stats`);
      if (res.ok) {
        const data = await res.json();
        setMetricsData(data);
      }
    } catch (e) {
      console.error('Failed to fetch container metrics:', e);
    }
  };

  const handleOpenMetrics = (container) => {
    setMetricsContainer(container);
    setMetricsModalOpen(true);
    fetchMetrics(container.id);
  };

  useEffect(() => {
    let interval;
    if (metricsModalOpen && metricsContainer) {
      interval = setInterval(() => {
        fetchMetrics(metricsContainer.id);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [metricsModalOpen, metricsContainer]);

  // Custom Domain Modal State
  // Custom Domain & SSL State
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [domainContainer, setDomainContainer] = useState(null);
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [sslEnabledInput, setSslEnabledInput] = useState(true);
  const [sslForceRedirectInput, setSslForceRedirectInput] = useState(true);
  const [savingDomain, setSavingDomain] = useState(false);

  const handleOpenDomainModal = (container) => {
    setDomainContainer(container);
    setCustomDomainInput(container.custom_domain || '');
    setSslEnabledInput(container.ssl_enabled !== false);
    setSslForceRedirectInput(container.ssl_force_redirect !== false);
    setDomainModalOpen(true);
  };

  // Project Settings Modal State
  const [projectSettingsModalOpen, setProjectSettingsModalOpen] = useState(false);
  const [projectSettingsContainer, setProjectSettingsContainer] = useState(null);

  const handleOpenProjectSettings = (container) => {
    setProjectSettingsContainer(container);
    setProjectSettingsModalOpen(true);
  };

  // Persistent Volumes State & Handlers
  const [volumes, setVolumes] = useState([]);
  const [createVolumeModalOpen, setCreateVolumeModalOpen] = useState(false);

  const fetchVolumes = useCallback(async () => {
    try {
      const res = await apiFetch('/volumes', {
        headers: { 'X-Workspace-Id': activeWorkspaceId },
      });
      if (res.ok) {
        const data = await res.json();
        setVolumes(data || []);
      }
    } catch (err) {
      void err;
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    const timer = setTimeout(fetchVolumes, 0);
    return () => clearTimeout(timer);
  }, [fetchVolumes]);

  const handleDeleteVolume = async (volId, volName) => {
    if (!window.confirm(`Delete volume "${volName}"? All persistent files on this disk will be removed.`)) return;
    try {
      const res = await apiFetch(`/volumes/${volId}`, {
        method: 'DELETE',
        headers: { 'X-Workspace-Id': activeWorkspaceId },
      });
      if (res.ok) {
        toast.success(`Volume "${volName}" deleted`);
        fetchVolumes();
      } else {
        toast.error('Failed to delete volume');
      }
    } catch (err) {
      toast.error('Network error deleting volume', { description: err?.message });
    }
  };

  const handleDetachVolume = async (volId) => {
    try {
      const res = await apiFetch(`/volumes/${volId}/detach`, {
        method: 'POST',
        headers: { 'X-Workspace-Id': activeWorkspaceId },
      });
      if (res.ok) {
        toast.success('Volume detached');
        fetchVolumes();
      }
    } catch (err) {
      void err;
    }
  };

  const handleSaveCustomDomain = async () => {
    if (!domainContainer) return;
    setSavingDomain(true);
    try {
      const res = await apiFetch(`/containers/${domainContainer.id}/domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          custom_domain: customDomainInput,
          ssl_enabled: sslEnabledInput,
          ssl_force_redirect: sslForceRedirectInput,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Custom domain & SSL settings saved successfully!');
        setDomainModalOpen(false);
        fetchContainers();
        window.dispatchEvent(new CustomEvent('notification-refresh'));
      } else {
        toast.error(data.error || 'Failed to update custom domain');
      }
    } catch (err) {
      toast.error('Network error saving domain', { description: err?.message });
    } finally {
      setSavingDomain(false);
    }
  };

  // Universal Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'primary', // 'primary' | 'danger' | 'warning'
    onConfirm: null,
  });

  const openConfirmModal = ({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'primary', onConfirm }) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      variant,
      onConfirm,
    });
  };

  // Notification State
  const prevStatesRef = useRef({});
  const prevDbStatesRef = useRef({});
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Desktop notifications are not supported in this browser');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setNotificationsEnabled(true);
        toast.success('Desktop alerts enabled!', {
          description: 'You will receive notifications if a server crashes or stops.',
        });
        new Notification('Notifications Enabled', {
          body: 'You will receive notifications if a server crashes or stops.',
        });
      } else {
        setNotificationsEnabled(false);
        toast.warning('Notification permission required', {
          description: 'Please enable notifications in your browser settings to receive alerts.',
        });
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    }
  };

  const fetchContainers = useCallback(async () => {
    try {
      const response = await apiFetch('/containers', {
        headers: { 'X-Workspace-Id': activeWorkspaceId }
      });
      const data = await response.json();
      if (response.ok) {
        const containerList = data || [];
        setContainers(containerList);
        
        // Detect stopped containers for desktop alerts
        const prevStates = prevStatesRef.current;
        const prevDbStates = prevDbStatesRef.current;
        containerList.forEach(c => {
          const key = c.id || String(c.deployment_id);
          const prevState = prevStates[key];
          const currentState = c.state;

          if (prevState === 'running' && (currentState === 'exited' || currentState === 'failed')) {
            const shortName = getShortAppName(c.name, c.clean_name);

            // 1. Toast notification
            toast.error(`Server stopped (${shortName})`, {
              description: `Service error (${currentState}). Please check logs.`,
              duration: 8000,
            });

            // 2. Desktop notification
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`Server stopped (${shortName})`, {
                  body: `Service: ${c.name} stopped (${currentState}). Check dashboard for details.`,
                });
              } catch (notifErr) {
                console.error('Desktop Notification error:', notifErr);
              }
            }
          }

          // Detect stopped databases for running backend services
          const wasDbStopped = prevDbStates[key];
          const isFrontendService = c.service_type === 'frontend' || c.name?.includes('(Frontend)');
          const isDbStopped = !isFrontendService && !!c.is_db_stopped;
          if (currentState === 'running' && isDbStopped && !wasDbStopped) {
            const shortName = getShortAppName(c.name, c.clean_name);
            const dbName = c.linked_db_name || 'Database';

            toast.warning(`Database disconnected (${shortName})`, {
              description: `Database "${dbName}" is stopped. The service cannot access data.`,
              duration: 8000,
            });

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`Database disconnected (${shortName})`, {
                  body: `Database: ${dbName} is offline.`,
                });
              } catch (notifErr) {
                console.error('Desktop Notification error:', notifErr);
              }
            }
          }

          prevStates[key] = currentState;
          prevDbStates[key] = isDbStopped;
        });
        prevStatesRef.current = prevStates;
        prevDbStatesRef.current = prevDbStates;

        // Container list loaded (stats not needed for deployments table)
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  const fetchDatabases = useCallback(async (shouldFetchStats = false) => {
    try {
      const res = await apiFetch('/databases', {
        headers: { 'X-Workspace-Id': activeWorkspaceId }
      });
      if (res.ok) {
        const data = await res.json();
        const dbList = data || [];
        setDatabases(dbList);

        // Fetch stats only when viewing Storage & Databases tab
        if (shouldFetchStats) {
          dbList.forEach(async (db) => {
            if (db.status === 'running' && db.container_id) {
              try {
                const statRes = await apiFetch(`/containers/${db.container_id}/stats`);
                if (statRes.ok) {
                  const statData = await statRes.json();
                  setStats(prev => ({ ...prev, [db.container_id]: statData }));
                }
              } catch (err) {
                void err;
              }
            }
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch databases:', err);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    const isStorageTab = activeTab === 'storage';
    const timer = setTimeout(() => {
      fetchContainers();
      fetchDatabases(isStorageTab);
    }, 0);
    
    const interval = setInterval(() => {
      if (document.hidden) return;

      fetchContainers();
      fetchDatabases(activeTab === 'storage');
    }, 6000);
    
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [fetchContainers, fetchDatabases, activeTab]);

  const handleCreateDatabase = async (e) => {
    e.preventDefault();
    if (!newDbName.trim()) {
      toast.warning('Please enter a database name');
      return;
    }
    setCreatingDb(true);
    const toastId = toast.loading('Creating database and mounting persistent volume...');
    try {
      const res = await apiFetch('/databases', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Workspace-Id': activeWorkspaceId,
        },
        body: JSON.stringify({ 
          name: newDbName.trim(), 
          type: 'postgres',
          workspace_id: activeWorkspaceId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Database created successfully!', {
          id: toastId,
          description: `PostgreSQL is ready on external port ${data.database.host_port}`,
        });
        setNewDbName('');
        setCreateDbModalOpen(false);
        fetchDatabases();
        refreshWorkspaces();
      } else {
        toast.error('Failed to create database', {
          id: toastId,
          description: data.error || 'Unknown error',
        });
      }
    } catch (err) {
      toast.error('Failed to connect to server', {
        id: toastId,
        description: err.message,
      });
    } finally {
      setCreatingDb(false);
    }
  };

  const handleToggleDb = async (id, currentStatus) => {
    const action = currentStatus === 'running' ? 'stop' : 'start';
    const toastId = toast.loading(action === 'stop' ? 'Stopping database...' : 'Starting database...');
    try {
      const res = await apiFetch(`/databases/${id}/${action}`, { method: 'POST' });
      if (res.ok) {
        toast.success(action === 'stop' ? 'Database stopped successfully' : 'Database started successfully', { id: toastId });
        fetchDatabases();
        fetchContainers();
        window.dispatchEvent(new CustomEvent('notification-refresh'));
      } else {
        const data = await res.json();
        toast.error('Operation failed', { id: toastId, description: data.error });
      }
    } catch (err) {
      toast.error('Connection failed', { id: toastId, description: err.message });
    }
  };

  const handleDeleteDb = (id, name) => {
    openConfirmModal({
      title: 'Delete Database',
      message: `Are you sure you want to permanently delete database "${name}"? All tables and volume data will be removed.`,
      confirmText: 'Delete Database',
      variant: 'danger',
      onConfirm: async () => {
        const toastId = toast.loading('Deleting database and clearing volume...');
        try {
          const res = await apiFetch(`/databases/${id}`, { method: 'DELETE' });
          if (res.ok) {
            toast.success('Database deleted successfully', { id: toastId });
            fetchDatabases();
            refreshWorkspaces();
            window.dispatchEvent(new CustomEvent('notification-refresh'));
          } else {
            const data = await res.json();
            toast.error('Deletion failed', { id: toastId, description: data.error });
          }
        } catch (err) {
          toast.error('Connection failed', { id: toastId, description: err.message });
        }
      }
    });
  };

  const handleCopyUrl = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Connection URL copied!', { description: 'Ready to paste into .env or database client' });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExecuteQuery = async (queryToRun, overrideDb) => {
    const targetDb = overrideDb || activeSqlDb;
    const q = queryToRun || sqlQuery;
    if (!q || !q.trim() || !targetDb) return;
    setRunningSql(true);
    try {
      const res = await apiFetch(`/databases/${targetDb.id}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSqlResult(data.result || 'Query executed successfully (no rows returned)');
        // Reload tables list
        const tblRes = await apiFetch(`/databases/${targetDb.id}/tables`);
        if (tblRes.ok) {
          const tblData = await tblRes.json();
          setSqlTables(tblData.tables || []);
        }
      } else {
        setSqlResult(`Error: ${data.error || 'Query failed'}`);
      }
    } catch (err) {
      setSqlResult(`Connection failed: ${err.message}`);
    } finally {
      setRunningSql(false);
    }
  };

  const handleOpenSqlStudio = async (db) => {
    setActiveSqlDb(db);
    setSqlModalOpen(true);
    setSqlResult('');
    setSqlTables([]);
    try {
      const res = await apiFetch(`/databases/${db.id}/tables`);
      if (res.ok) {
        const data = await res.json();
        const tables = data.tables || [];
        setSqlTables(tables);
        if (tables.length > 0) {
          const autoQuery = `SELECT * FROM ${tables[0]} LIMIT 20;`;
          setSqlQuery(autoQuery);
          handleExecuteQuery(autoQuery, db);
        } else {
          const defaultQuery = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';";
          setSqlQuery(defaultQuery);
          handleExecuteQuery(defaultQuery, db);
        }
      }
    } catch (err) {
      console.error('Failed to load tables:', err);
    }
  };

  const handleOpenBindModal = (db) => {
    setActiveBindDb(db);
    const runningServers = containers.filter(c => c.state === 'running');
    setSelectedTargetContainer(runningServers.length > 0 ? (runningServers[0].id || String(runningServers[0].deployment_id)) : '');
    setBindModalOpen(true);
  };

  const handleConfirmBind = async () => {
    if (!selectedTargetContainer || !activeBindDb) {
      toast.warning('Please select a target server to bind');
      return;
    }
    setBindingServer(true);
    const toastId = toast.loading('Binding database to server and restarting...');
    try {
      const res = await apiFetch(`/databases/${activeBindDb.id}/bind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container_id: selectedTargetContainer }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Database bound successfully!', {
          id: toastId,
          description: 'Database environment variables injected and server restarted',
        });
        setBindModalOpen(false);
        fetchContainers();
        window.dispatchEvent(new CustomEvent('notification-refresh'));
      } else {
        toast.error('Failed to bind database', { id: toastId, description: data.error });
      }
    } catch (err) {
      toast.error('Connection failed', { id: toastId, description: err.message });
    } finally {
      setBindingServer(false);
    }
  };

  const handleBackupDb = async (db) => {
    setBackingUpId(db.id);
    const toastId = toast.loading(`Generating backup (.sql) for "${db.name}"...`);
    try {
      const response = await apiFetch(`/databases/${db.id}/backup`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Unable to download backup');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `backup-${db.name}-${dateStr}.sql`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success('Backup downloaded successfully!', {
        id: toastId,
        description: `Created backup-${db.name}.sql file`,
      });
      window.dispatchEvent(new CustomEvent('notification-refresh'));
    } catch (err) {
      toast.error('Backup failed', { id: toastId, description: err.message });
    } finally {
      setBackingUpId(null);
    }
  };

  const handleOpenRestoreModal = (db) => {
    setActiveRestoreDb(db);
    setRestoreFile(null);
    setRestoreResult('');
    setRestoreModalOpen(true);
  };

  const handleExecuteRestore = async () => {
    if (!restoreFile || !activeRestoreDb) {
      toast.warning('Please select a .sql file to restore');
      return;
    }

    setRestoring(true);
    setRestoreResult('');
    const toastId = toast.loading(`Restoring database into "${activeRestoreDb.name}"...`);

    const formData = new FormData();
    formData.append('file', restoreFile);

    try {
      const res = await apiFetch(`/databases/${activeRestoreDb.id}/restore`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Database restored successfully!', { id: toastId });
        setRestoreResult(data.output || 'Restore Completed Successfully.');
        window.dispatchEvent(new CustomEvent('notification-refresh'));
      } else {
        toast.error('Database restore failed', { id: toastId, description: data.error });
        setRestoreResult(`Error: ${data.error}\n${data.output || ''}`);
      }
    } catch (err) {
      toast.error('Connection failed', { id: toastId, description: err.message });
      setRestoreResult(`Network Error: ${err.message}`);
    } finally {
      setRestoring(false);
    }
  };

  const handleOpenSnapshotModal = async (db) => {
    setActiveSnapshotDb(db);
    setSnapshotModalOpen(true);
    setSnapshotNote('');
    setConfirmRestoreSnapshot(null);
    setActiveSnapshotTab('list');
    await fetchSnapshots(db.id);
  };

  const fetchSnapshots = async (dbId) => {
    setLoadingSnapshots(true);
    try {
      const res = await apiFetch(`/databases/${dbId}/snapshots`);
      if (res.ok) {
        const data = await res.json();
        setSnapshots(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to load snapshots:', e);
    } finally {
      setLoadingSnapshots(false);
    }
  };

  const handleTakeSnapshot = async () => {
    if (!activeSnapshotDb) return;
    setTakingSnapshot(true);
    const toastId = toast.loading(`Taking snapshot for "${activeSnapshotDb.name}"...`);
    try {
      const res = await apiFetch(`/databases/${activeSnapshotDb.id}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: snapshotNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create snapshot');
      }
      toast.success('Snapshot created successfully!', {
        id: toastId,
        description: `${data.snapshot.file_name} (${data.snapshot.formatted_size})`,
      });
      setSnapshotNote('');
      await fetchSnapshots(activeSnapshotDb.id);
      window.dispatchEvent(new CustomEvent('notification-refresh'));
    } catch (err) {
      toast.error('Snapshot failed', { id: toastId, description: err.message });
    } finally {
      setTakingSnapshot(false);
    }
  };

  const handleRestoreFromSnapshot = async (snapshot) => {
    if (!activeSnapshotDb) return;
    setRestoringSnapshotId(snapshot.id);
    const toastId = toast.loading(`Restoring database from snapshot "${snapshot.file_name}"...`);
    try {
      const res = await apiFetch(`/databases/${activeSnapshotDb.id}/snapshots/${snapshot.id}/restore`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to restore snapshot');
      }
      toast.success('Database restored successfully from snapshot!', {
        id: toastId,
        description: 'All tables and data have been restored.',
      });
      setConfirmRestoreSnapshot(null);
      window.dispatchEvent(new CustomEvent('notification-refresh'));
    } catch (err) {
      toast.error('Restore failed', { id: toastId, description: err.message });
    } finally {
      setRestoringSnapshotId(null);
    }
  };

  const handleDeleteSnapshot = async (snapshotId) => {
    if (!activeSnapshotDb) return;
    setDeletingSnapshotId(snapshotId);
    try {
      const res = await apiFetch(`/databases/${activeSnapshotDb.id}/snapshots/${snapshotId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Snapshot deleted');
        setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
      } else {
        const data = await res.json();
        toast.error('Failed to delete snapshot', { description: data.error });
      }
    } catch (err) {
      toast.error('Failed to delete snapshot', { description: err.message });
    } finally {
      setDeletingSnapshotId(null);
    }
  };

  const handleDownloadSnapshot = (dbId, snapshot) => {
    const a = document.createElement('a');
    a.href = `${API_BASE_URL}/databases/${dbId}/snapshots/${snapshot.id}/download`;
    a.download = snapshot.file_name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Releases & Instant Rollback Handlers
  const handleOpenReleasesModal = async (container) => {
    setActiveReleasesContainer(container);
    setReleasesModalOpen(true);
    setConfirmRollbackRelease(null);
    await fetchReleases(container.id);
  };

  const fetchReleases = async (containerId) => {
    setLoadingReleases(true);
    try {
      const res = await apiFetch(`/containers/${containerId}/releases`);
      if (res.ok) {
        const data = await res.json();
        setReleases(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to load deployment releases:', e);
      toast.error('Failed to load release history');
    } finally {
      setLoadingReleases(false);
    }
  };

  const handleExecuteRollback = async (release) => {
    if (!activeReleasesContainer || !release) return;
    setRollingBackId(release.id);
    const toastId = toast.loading(`Rolling back to release #${release.release_num || release.id.slice(0, 7)}...`);
    try {
      const res = await apiFetch(`/containers/${activeReleasesContainer.id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ release_id: release.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to rollback release');
      }
      toast.success('Rolled back successfully!', {
        id: toastId,
        description: `Active release is now ${release.commit_hash ? release.commit_hash.slice(0, 7) : 'v' + release.release_num}`,
      });
      setConfirmRollbackRelease(null);
      await fetchReleases(activeReleasesContainer.id);
      await fetchContainers();
      window.dispatchEvent(new CustomEvent('notification-refresh'));
    } catch (err) {
      toast.error('Rollback failed', { id: toastId, description: err.message });
    } finally {
      setRollingBackId(null);
    }
  };

  const handleOpenWebhookModal = (container) => {
    setActiveWebhookContainer(container);
    setWebhookModalOpen(true);
  };

  const handleTestWebhookPing = async () => {
    if (!activeWebhookContainer?.deployment_id) return;
    setPingingWebhook(true);
    const toastId = toast.loading('Sending test ping to webhook...');
    try {
      const res = await apiFetch(`/webhooks/deploy/${activeWebhookContainer.deployment_id}`, {
        method: 'POST',
        headers: {
          'X-GitHub-Event': 'ping',
        },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Webhook responded successfully (Pong!)', {
          id: toastId,
          description: data.message || 'Ready to receive GitHub push events',
        });
      } else {
        toast.error('Test failed', { id: toastId, description: data.error });
      }
    } catch (err) {
      toast.error('Connection failed', { id: toastId, description: err.message });
    } finally {
      setPingingWebhook(false);
    }
  };

  const handleAction = async (id, action, containerName) => {
    if (action === 'delete') {
      handleDelete(id);
      return;
    }
    const shortName = getShortAppName(containerName);
    const actionLabel = action === 'stop' ? `Stopping ${shortName}...` : `Starting ${shortName}...`;
    const toastId = toast.loading(actionLabel);
    try {
      setLoading(true); // Prevent spamming actions
      const res = await apiFetch(`/containers/${id}/${action}`, {
        method: 'POST',
        headers: { 'X-Workspace-Id': activeWorkspaceId },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // If start fails or app crashes, show error modal
        const errorTitle = data.error || `Command ${action} failed`;
        const errorDetails = data.details || errorTitle;
        toast.error('Operation failed', { id: toastId, description: errorDetails });
        setActiveErrorContainerName(containerName || id);
        setActiveErrorDetails(errorDetails);
        setErrorModalOpen(true);
      } else {
        toast.success(action === 'stop' ? `Service stopped (${shortName})` : `Service started (${shortName})`, {
          id: toastId,
          description: action === 'stop' ? 'Container is now offline' : 'Container is now running',
        });
        window.dispatchEvent(new CustomEvent('notification-refresh'));
      }
      await fetchContainers(); // Refresh container data
    } catch (error) {
      console.error("Operation failed:", error);
      toast.error("Connection failed", { id: toastId, description: error.message });
      setActiveErrorContainerName(containerName || id);
      setActiveErrorDetails(error.message);
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (identifier) => {
    if (!identifier) {
      toast.error("Server ID not found");
      return;
    }

    openConfirmModal({
      title: 'Delete Server',
      message: 'Are you sure you want to delete this server? The container and its runtime history will be permanently removed.',
      confirmText: 'Delete Server',
      variant: 'danger',
      onConfirm: async () => {
        // Optimistic UI update
        setContainers(prev => prev.filter(c => c.id !== identifier && c.deployment_id !== identifier));
        const toastId = toast.loading("Deleting server...");

        try {
          const res = await apiFetch(`/containers/${identifier}`, {
            method: 'DELETE',
            headers: { 'X-Workspace-Id': activeWorkspaceId },
          });
          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            toast.error("Failed to delete server", { id: toastId, description: errJson.error || "Deletion failed" });
          } else {
            toast.success("Server deleted successfully", { id: toastId });
            window.dispatchEvent(new CustomEvent('notification-refresh'));
          }
          await fetchContainers();
          refreshWorkspaces();
        } catch (error) {
          toast.error("Server connection failed", { id: toastId, description: error.message });
          await fetchContainers();
          refreshWorkspaces();
        }
      }
    });
  };

  const handleViewLogs = async (id, name) => {
    setLogModalOpen(true);
    setLogLoading(true);
    setActiveContainerName(name);
    setCurrentLogs('');
    try {
      const response = await apiFetch(`/containers/${id}/logs`);
      const text = await response.text();
      setCurrentLogs(text || 'No logs available for this container.');
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      setCurrentLogs('Error fetching logs. Please try again.');
    } finally {
      setLogLoading(false);
    }
  };

  // Trigger redeploy
  const handleRedeploy = (id) => {
    openConfirmModal({
      title: 'Re-deploy Server',
      message: 'Pull latest code from Git and build a new container? (Zero-downtime rebuild)',
      confirmText: 'Start Re-deploy',
      variant: 'primary',
      onConfirm: async () => {
        toast.info("Starting re-deployment...", {
          description: "Pulling latest code and building container",
        });

        // 1. Optimistic status update
        setContainers(prev => prev.map(c => 
          c.id === id ? { ...c, state: 'redeploying' } : c
        ));

        try {
          const response = await apiFetch(`/containers/${id}/redeploy`, {
            method: 'POST',
          });
          
          if (response.ok) {
            // 2. Poll for updates
            const checkInterval = setInterval(() => {
              fetchContainers(); 
              window.dispatchEvent(new CustomEvent('notification-refresh'));
            }, 3000);

            setTimeout(() => {
              clearInterval(checkInterval);
              fetchContainers();
              window.dispatchEvent(new CustomEvent('notification-refresh'));
            }, 120000);
          } else {
            toast.error("Re-deployment failed");
            fetchContainers();
            window.dispatchEvent(new CustomEvent('notification-refresh'));
          }
        } catch (error) {
          console.error("Redeploy error:", error);
          toast.error("Server connection failed");
          fetchContainers();
        }
      }
    });
  };

  const handleOpenEnv = async (id, name) => {
    setActiveEnvContainerId(id);
    setActiveEnvContainerName(name);
    setCurrentEnvText('');
    setEnvError('');
    setEnvSuccess('');
    setEnvModalOpen(true);

    try {
      const res = await apiFetch(`/containers/${id}/env`);
      const data = await res.json();
      if (res.ok && data.env) {
        // Display environment variables
        setCurrentEnvText(data.env.join('\n'));
      }
    } catch (err) {
      setEnvError('Failed to load environment variables: ' + err.message);
    }
  };

  const handleSaveEnv = async () => {
    setEnvSaving(true);
    setEnvError('');
    setEnvSuccess('');

    try {
      const res = await apiFetch(`/containers/${activeEnvContainerId}/env`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ env_vars: currentEnvText }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnvSuccess('Environment variables saved and server restarted!');
        fetchContainers();
        window.dispatchEvent(new CustomEvent('notification-refresh'));
        setTimeout(() => {
          setEnvModalOpen(false);
        }, 1500);
      } else {
        setEnvError(data.error || 'Failed to save environment variables');
      }
    } catch (err) {
      setEnvError('An error occurred: ' + err.message);
    } finally {
      setEnvSaving(false);
    }
  };


  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 border border-neutral-800 rounded-full"></div>
        <div className="absolute inset-0 border border-white rounded-full border-t-transparent animate-spin"></div>
      </div>
      <p className="text-neutral-500 font-mono text-xs animate-pulse">Connecting to Docker Engine...</p>
    </div>
  );

  const crashedContainers = containers.filter(c => c.state === 'exited' || c.state === 'failed' || c.state === 'restarting');
  const dbDisconnectedContainers = containers.filter(c => c.state === 'running' && c.service_type !== 'frontend' && !c.name?.includes('(Frontend)') && c.is_db_stopped);

  return (
    <div className="space-y-6">
      {/* Vercel Subnavigation Tabs */}
      <DashboardSubnav
        activeTab={activeTab}
        setSearchParams={setSearchParams}
        containersCount={containers.length}
        databasesCount={databases.length}
        onCreateDbClick={() => setCreateDbModalOpen(true)}
      />

      {/* Tab 1: Deployments (Server / Microservices) */}
      {activeTab === 'deployments' && (
        <div className="bg-[#0a0a0a] p-3.5 sm:p-5 md:p-6 rounded-xl border border-neutral-800 relative">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3 sm:gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight flex items-center gap-2">
                <Server className="w-4 h-4 text-neutral-300" />
                Active Deployments
              </h3>
              <p className="text-neutral-400 text-xs mt-0.5">Manage deployed microservices, APIs, and frontends.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={requestNotificationPermission}
                className={`px-2.5 sm:px-3 py-1 rounded-md text-xs font-mono border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  notificationsEnabled
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                }`}
                title={notificationsEnabled ? 'Desktop alerts enabled' : 'Click to enable desktop alerts when servers stop'}
              >
                {notificationsEnabled ? (
                  <BellRing className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Bell className="w-3.5 h-3.5 text-neutral-400" />
                )}
                {notificationsEnabled ? 'Desktop Alerts: On' : 'Alerts: Off'}
              </button>

              <span className="bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-mono px-2.5 sm:px-3 py-1 rounded-md flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Running: {containers.filter(c => c.state === 'running').length} / {containers.length}
              </span>
            </div>
          </div>

      {/* Alert Banner for stopped/crashed servers */}
      {crashedContainers.length > 0 && !dismissAlert && (
        <div className="mb-6 p-3.5 rounded-lg bg-neutral-950 border border-rose-900/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <div>
              <h4 className="font-medium text-rose-300 text-xs font-mono">
                Stopped Services ({crashedContainers.length})
              </h4>
              <p className="text-neutral-400 text-xs mt-0.5">
                Click <span className="text-neutral-200 font-mono">[Logs]</span> to view error details, or resume container.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissAlert(true)}
            className="text-neutral-500 hover:text-white p-1 rounded hover:bg-neutral-900 transition-colors cursor-pointer"
            title="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Alert Banner for disconnected databases */}
      {dbDisconnectedContainers.length > 0 && !dismissDbAlert && (
        <div className="mb-6 p-3.5 rounded-lg bg-neutral-950 border border-amber-900/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <div>
              <h4 className="font-medium text-amber-300 text-xs font-mono">
                Database Offline ({dbDisconnectedContainers.length} service affected)
              </h4>
              <p className="text-neutral-400 text-xs mt-0.5">
                Database <span className="text-neutral-200 font-mono">({dbDisconnectedContainers[0].linked_db_name || 'Database'})</span> is offline.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {dbDisconnectedContainers[0]?.linked_db_id && (
              <button
                type="button"
                onClick={() => handleToggleDb(dbDisconnectedContainers[0].linked_db_id, 'stopped')}
                className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                Resume DB
              </button>
            )}
            <button
              type="button"
              onClick={() => setDismissDbAlert(true)}
              className="text-neutral-500 hover:text-white p-1 rounded hover:bg-neutral-900 transition-colors cursor-pointer"
              title="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {containers.length === 0 ? (
        <div className="text-center py-16 bg-neutral-950 rounded-lg border border-neutral-800">
          <div className="w-12 h-12 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto mb-3 text-neutral-400">
            <Box className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-medium text-white mb-1">No services deployed yet</h4>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-4 font-mono">
            Deploy your first git repository or microservice to get started.
          </p>
          <Link
            to="/deploy"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-black hover:bg-neutral-200 border border-white rounded-md text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Deploy First Service</span>
          </Link>
        </div>
      ) : (
        <div className="relative z-10 w-full">
          <div className="bg-black border border-neutral-800 rounded-lg overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-800 min-h-[180px] pb-4">
            <table className="w-full min-w-[580px] lg:min-w-full table-auto text-left">
                <thead className="bg-neutral-950/90 border-b border-neutral-800">
                  <tr>
                    <th scope="col" className="px-3 sm:px-4 py-3 text-xs font-semibold text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                      Deployment
                    </th>
                    <th scope="col" className="hidden xl:table-cell px-4 py-3 text-xs font-semibold text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                      Description / Commit
                    </th>
                    <th scope="col" className="px-3 sm:px-4 py-3 text-xs font-semibold text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="hidden sm:table-cell px-4 py-3 text-xs font-semibold text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                      Environment
                    </th>
                    <th scope="col" className="hidden lg:table-cell px-4 py-3 text-xs font-semibold text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                      Commit
                    </th>
                    <th scope="col" className="hidden lg:table-cell px-4 py-3 text-xs font-semibold text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                      Branch
                    </th>
                    <th scope="col" className="hidden sm:table-cell px-4 py-3 text-xs font-semibold text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                      Age
                    </th>
                    <th scope="col" className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-neutral-400 font-mono text-[11px] uppercase tracking-wider w-16 sm:w-20">
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900 bg-black">
                  {containers.map((item) => (
                    <DeploymentTableRow
                      key={item.id}
                      item={item}
                      isMenuOpen={activeMenuId === item.id}
                      setActiveMenuId={setActiveMenuId}
                      containers={containers}
                      handleOpenDomainModal={handleOpenDomainModal}
                      handleOpenEnv={handleOpenEnv}
                      handleOpenProjectSettings={handleOpenProjectSettings}
                      handleOpenReleasesModal={handleOpenReleasesModal}
                      handleOpenWebhookModal={handleOpenWebhookModal}
                      handleOpenMetrics={handleOpenMetrics}
                      handleViewLogs={handleViewLogs}
                      handleRedeploy={handleRedeploy}
                      handleAction={handleAction}
                      handleDelete={handleDelete}
                      setActiveErrorDetails={setActiveErrorDetails}
                      setActiveErrorContainerName={setActiveErrorContainerName}
                      setErrorModalOpen={setErrorModalOpen}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      )}
      </div>
      )}

      {/* Tab 2: Storage & Databases (Managed PostgreSQL & Persistent Volumes) */}
      {activeTab === 'storage' && (
        <StorageSection
          databases={databases}
          volumes={volumes}
          stats={stats}
          onCreateDbClick={() => setCreateDbModalOpen(true)}
          onCreateVolumeClick={() => setCreateVolumeModalOpen(true)}
          handleToggleDb={handleToggleDb}
          handleDeleteDb={handleDeleteDb}
          handleDetachVolume={handleDetachVolume}
          handleDeleteVolume={handleDeleteVolume}
          handleOpenSqlStudio={handleOpenSqlStudio}
          handleOpenBindModal={handleOpenBindModal}
          handleOpenSnapshotModal={handleOpenSnapshotModal}
          handleBackupDb={handleBackupDb}
          backingUpId={backingUpId}
          handleOpenRestoreModal={handleOpenRestoreModal}
          handleCopyUrl={handleCopyUrl}
          copiedKey={copiedKey}
        />
      )}

      {/* Modals & Dialogs */}
      <EnvVariablesModal
        isOpen={envModalOpen}
        onClose={() => setEnvModalOpen(false)}
        activeEnvContainerName={activeEnvContainerName}
        envError={envError}
        envSuccess={envSuccess}
        databases={databases}
        currentEnvText={currentEnvText}
        setCurrentEnvText={setCurrentEnvText}
        envSaving={envSaving}
        handleSaveEnv={handleSaveEnv}
      />

      <ContainerLogsModal
        isOpen={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        activeContainerName={activeContainerName}
        logLoading={logLoading}
        currentLogs={currentLogs}
      />

      <ErrorDetailsModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        activeErrorContainerName={activeErrorContainerName}
        activeErrorDetails={activeErrorDetails}
        extractCrashRootCause={extractCrashRootCause}
      />

      <CreateDatabaseModal
        isOpen={createDbModalOpen}
        onClose={() => setCreateDbModalOpen(false)}
        handleCreateDatabase={handleCreateDatabase}
        newDbName={newDbName}
        setNewDbName={setNewDbName}
        creatingDb={creatingDb}
      />

      <WebSqlStudioModal
        isOpen={sqlModalOpen}
        onClose={() => setSqlModalOpen(false)}
        activeSqlDb={activeSqlDb}
        sqlTables={sqlTables}
        sqlQuery={sqlQuery}
        setSqlQuery={setSqlQuery}
        handleExecuteQuery={handleExecuteQuery}
        runningSql={runningSql}
        sqlResult={sqlResult}
        handleCopyUrl={handleCopyUrl}
        copiedKey={copiedKey}
      />

      <BindDatabaseModal
        isOpen={bindModalOpen}
        onClose={() => setBindModalOpen(false)}
        activeBindDb={activeBindDb}
        containers={containers}
        selectedTargetContainer={selectedTargetContainer}
        setSelectedTargetContainer={setSelectedTargetContainer}
        handleConfirmBind={handleConfirmBind}
        bindingServer={bindingServer}
        getShortAppName={getShortAppName}
      />

      <DatabaseSnapshotModal
        isOpen={snapshotModalOpen}
        onClose={() => setSnapshotModalOpen(false)}
        activeSnapshotDb={activeSnapshotDb}
        activeSnapshotTab={activeSnapshotTab}
        setActiveSnapshotTab={setActiveSnapshotTab}
        snapshots={snapshots}
        snapshotNote={snapshotNote}
        setSnapshotNote={setSnapshotNote}
        takingSnapshot={takingSnapshot}
        handleTakeSnapshot={handleTakeSnapshot}
        confirmRestoreSnapshot={confirmRestoreSnapshot}
        setConfirmRestoreSnapshot={setConfirmRestoreSnapshot}
        handleRestoreFromSnapshot={handleRestoreFromSnapshot}
        restoringSnapshotId={restoringSnapshotId}
        loadingSnapshots={loadingSnapshots}
        handleDownloadSnapshot={handleDownloadSnapshot}
        handleDeleteSnapshot={handleDeleteSnapshot}
        deletingSnapshotId={deletingSnapshotId}
        restoreFile={restoreFile}
        setRestoreFile={setRestoreFile}
        restoreResult={restoreResult}
        setRestoreResult={setRestoreResult}
        restoring={restoring}
        setRestoring={setRestoring}
      />

      <DeploymentReleasesModal
        isOpen={releasesModalOpen}
        onClose={() => setReleasesModalOpen(false)}
        activeReleasesContainer={activeReleasesContainer}
        loadingReleases={loadingReleases}
        releases={releases}
        getGitCommitUrl={getGitCommitUrl}
        formatTimeAgo={formatTimeAgo}
        confirmRollbackRelease={confirmRollbackRelease}
        setConfirmRollbackRelease={setConfirmRollbackRelease}
        rollingBackId={rollingBackId}
        handleExecuteRollback={handleExecuteRollback}
      />

      <RestoreDatabaseModal
        isOpen={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
        activeRestoreDb={activeRestoreDb}
        restoreFile={restoreFile}
        setRestoreFile={setRestoreFile}
        restoreResult={restoreResult}
        handleExecuteRestore={handleExecuteRestore}
        restoring={restoring}
      />

      <WebhookModal
        isOpen={webhookModalOpen}
        onClose={() => setWebhookModalOpen(false)}
        activeWebhookContainer={activeWebhookContainer}
        getShortAppName={getShortAppName}
        customPublicUrl={customPublicUrl}
        handleCopyUrl={handleCopyUrl}
        copiedKey={copiedKey}
        handleUpdatePublicUrl={handleUpdatePublicUrl}
        handleTestWebhookPing={handleTestWebhookPing}
        pingingWebhook={pingingWebhook}
      />

      <LiveMetricsModal
        isOpen={metricsModalOpen}
        onClose={() => setMetricsModalOpen(false)}
        metricsContainer={metricsContainer}
        metricsData={metricsData}
      />

      <CustomDomainModal
        isOpen={domainModalOpen}
        onClose={() => setDomainModalOpen(false)}
        domainContainer={domainContainer}
        customDomainInput={customDomainInput}
        setCustomDomainInput={setCustomDomainInput}
        sslEnabledInput={sslEnabledInput}
        setSslEnabledInput={setSslEnabledInput}
        sslForceRedirectInput={sslForceRedirectInput}
        setSslForceRedirectInput={setSslForceRedirectInput}
        handleSaveCustomDomain={handleSaveCustomDomain}
        savingDomain={savingDomain}
      />

      <ProjectSettingsModal
        isOpen={projectSettingsModalOpen}
        onClose={() => setProjectSettingsModalOpen(false)}
        container={projectSettingsContainer}
        onUpdated={fetchContainers}
      />

      <CreateVolumeModal
        isOpen={createVolumeModalOpen}
        onClose={() => setCreateVolumeModalOpen(false)}
        onCreated={fetchVolumes}
      />

      <UniversalConfirmModal
        confirmModal={confirmModal}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default DashboardHome;
