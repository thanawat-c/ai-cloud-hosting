import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Server, Play, Square, Trash2, ExternalLink, Activity, Box, Terminal, FileText, X, Cpu, HardDrive, RefreshCw, AlertTriangle, Settings, AlertCircle, CheckCircle2, Layers, Globe, Database, Bell, BellRing, Sparkles, Copy, Check, Plus, Link2, Table, Code, Search, Download, Upload, GitBranch, Webhook, Clock, Send, MoreHorizontal, ArrowUpRight, GitCommit } from 'lucide-react';
import { toast } from 'sonner';

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

// Format full date and time
const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const DashboardHome = () => {
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
      const response = await fetch('http://localhost:8080/api/containers');
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

          // Detect stopped databases for running services
          const wasDbStopped = prevDbStates[key];
          const isDbStopped = !!c.is_db_stopped;
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

        // Fetch stats for all running containers asynchronously
        containerList.forEach(async (c) => {
          if (c.state === 'running') {
            try {
              const statRes = await fetch(`http://localhost:8080/api/containers/${c.id}/stats`);
              if (statRes.ok) {
                const statData = await statRes.json();
                setStats(prev => ({ ...prev, [c.id]: statData }));
              }
            } catch (err) {
              console.error("Failed to fetch stats for", c.id, err);
            }
          }
        });
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDatabases = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8080/api/databases');
      if (res.ok) {
        const data = await res.json();
        const dbList = data || [];
        setDatabases(dbList);

        // Fetch stats for all running database containers
        dbList.forEach(async (db) => {
          if (db.status === 'running' && db.container_id) {
            try {
              const statRes = await fetch(`http://localhost:8080/api/containers/${db.container_id}/stats`);
              if (statRes.ok) {
                const statData = await statRes.json();
                setStats(prev => ({ ...prev, [db.container_id]: statData }));
              }
            } catch (err) {}
          }
        });
      }
    } catch (err) {
      console.error('Failed to fetch databases:', err);
    }
  }, []);

  useEffect(() => {
    const initFetch = async () => {
      await Promise.all([fetchContainers(), fetchDatabases()]);
    };
    initFetch();
    
    const interval = setInterval(() => {
      fetchContainers();
      fetchDatabases();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [fetchContainers, fetchDatabases]);

  const handleCreateDatabase = async (e) => {
    e.preventDefault();
    if (!newDbName.trim()) {
      toast.warning('Please enter a database name');
      return;
    }
    setCreatingDb(true);
    const toastId = toast.loading('Creating database and mounting persistent volume...');
    try {
      const res = await fetch('http://localhost:8080/api/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDbName.trim(), type: 'postgres' }),
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
      const res = await fetch(`http://localhost:8080/api/databases/${id}/${action}`, { method: 'POST' });
      if (res.ok) {
        toast.success(action === 'stop' ? 'Database stopped successfully' : 'Database started successfully', { id: toastId });
        fetchDatabases();
        fetchContainers();
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
          const res = await fetch(`http://localhost:8080/api/databases/${id}`, { method: 'DELETE' });
          if (res.ok) {
            toast.success('Database deleted successfully', { id: toastId });
            fetchDatabases();
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

  const handleCopyApiUrl = (url, key) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    toast.success('API endpoint copied', { description: url });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExecuteQuery = async (queryToRun, overrideDb) => {
    const targetDb = overrideDb || activeSqlDb;
    const q = queryToRun || sqlQuery;
    if (!q || !q.trim() || !targetDb) return;
    setRunningSql(true);
    try {
      const res = await fetch(`http://localhost:8080/api/databases/${targetDb.id}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSqlResult(data.result || 'Query executed successfully (no rows returned)');
        // Reload tables list
        const tblRes = await fetch(`http://localhost:8080/api/databases/${targetDb.id}/tables`);
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
      const res = await fetch(`http://localhost:8080/api/databases/${db.id}/tables`);
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
      const res = await fetch(`http://localhost:8080/api/databases/${activeBindDb.id}/bind`, {
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
      const response = await fetch(`http://localhost:8080/api/databases/${db.id}/backup`);
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
      const res = await fetch(`http://localhost:8080/api/databases/${activeRestoreDb.id}/restore`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Database restored successfully!', { id: toastId });
        setRestoreResult(data.output || 'Restore Completed Successfully.');
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

  const handleOpenWebhookModal = (container) => {
    setActiveWebhookContainer(container);
    setWebhookModalOpen(true);
  };

  const handleTestWebhookPing = async () => {
    if (!activeWebhookContainer?.deployment_id) return;
    setPingingWebhook(true);
    const toastId = toast.loading('Sending test ping to webhook...');
    try {
      const res = await fetch(`http://localhost:8080/api/webhooks/deploy/${activeWebhookContainer.deployment_id}`, {
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
    try {
      setLoading(true); // Prevent spamming actions
      const res = await fetch(`http://localhost:8080/api/containers/${id}/${action}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // If start fails or app crashes, show error modal
        const errorTitle = data.error || `Command ${action} failed`;
        const errorDetails = data.details || errorTitle;
        setActiveErrorContainerName(containerName || id);
        setActiveErrorDetails(errorDetails);
        setErrorModalOpen(true);
      }
      await fetchContainers(); // Refresh container data
    } catch (error) {
      console.error("Operation failed:", error);
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
          const res = await fetch(`http://localhost:8080/api/containers/${identifier}`, { method: 'DELETE' });
          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            toast.error("Failed to delete server", { id: toastId, description: errJson.error || "Deletion failed" });
          } else {
            toast.success("Server deleted successfully", { id: toastId });
          }
          await fetchContainers();
        } catch (error) {
          console.log("Deletion failed", error);
          toast.error("Server connection failed", { id: toastId, description: error.message });
          await fetchContainers();
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
      const response = await fetch(`http://localhost:8080/api/containers/${id}/logs`);
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
          const response = await fetch(`http://localhost:8080/api/containers/${id}/redeploy`, {
            method: 'POST',
          });
          
          if (response.ok) {
            // 2. Poll for updates
            const checkInterval = setInterval(() => {
              fetchContainers(); 
            }, 3000);

            setTimeout(() => {
              clearInterval(checkInterval);
              fetchContainers();
            }, 120000);
          } else {
            toast.error("Re-deployment failed");
            fetchContainers();
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
      const res = await fetch(`http://localhost:8080/api/containers/${id}/env`);
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
      const res = await fetch(`http://localhost:8080/api/containers/${activeEnvContainerId}/env`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ env_vars: currentEnvText }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnvSuccess('Environment variables saved and server restarted!');
        fetchContainers();
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
  const dbDisconnectedContainers = containers.filter(c => c.state === 'running' && c.is_db_stopped);

  return (
    <div className="space-y-6">
      {/* Vercel Geist Subnavigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'deployments' })}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'deployments'
                ? 'bg-neutral-900 text-white border border-neutral-800'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-950 border border-transparent'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-neutral-400" />
            <span>Deployments</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              activeTab === 'deployments' ? 'bg-neutral-800 text-white' : 'bg-neutral-950 text-neutral-500'
            }`}>
              {containers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'storage' })}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'storage'
                ? 'bg-neutral-900 text-white border border-neutral-800'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-950 border border-transparent'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-neutral-400" />
            <span>Storage & Databases</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              activeTab === 'storage' ? 'bg-neutral-800 text-white' : 'bg-neutral-950 text-neutral-500'
            }`}>
              {databases.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'deployments' ? (
            <Link
              to="/deploy"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-200 text-black border border-white rounded-md text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Deploy Service</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setCreateDbModalOpen(true)}
              disabled={databases.length >= 5}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-200 disabled:opacity-40 text-black border border-white rounded-md text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Database</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Deployments (Server / Microservices) */}
      {activeTab === 'deployments' && (
        <div className="bg-[#0a0a0a] p-6 rounded-xl border border-neutral-800 relative">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
                <Server className="w-4 h-4 text-neutral-300" />
                Active Deployments
              </h3>
              <p className="text-neutral-400 text-xs mt-0.5">Manage deployed microservices, APIs, and frontends.</p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={requestNotificationPermission}
                className={`px-3 py-1 rounded-md text-xs font-mono border flex items-center gap-1.5 transition-colors cursor-pointer ${
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

              <span className="bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-mono px-3 py-1 rounded-md flex items-center gap-2">
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
          <div className="bg-black border border-neutral-800 rounded-lg overflow-visible">
            <table className="w-full table-auto text-left">
                <thead className="bg-neutral-950/90 border-b border-neutral-800">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                      Deployment
                    </th>
                    <th scope="col" className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                      Description / Commit
                    </th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
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
                    <th scope="col" className="px-4 py-3 text-xs font-semibold text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                      Age
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 font-mono text-[11px] uppercase tracking-wider w-20">
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900 bg-black">
                  {containers.map((item) => {
                    const isRunning = item.state === 'running';
                    const isCrashed = item.state === 'failed' || item.last_error || item.state === 'exited' || item.state === 'restarting';
                    const isUpdating = item.state === 'redeploying';
                    const isDbStopped = isRunning && item.is_db_stopped;
                    const shortName = getShortAppName(item.name, item.clean_name);
                    const isMenuOpen = activeMenuId === item.id;

                    const description = item.service_type === 'backend' || item.name?.includes('(Backend)')
                      ? 'Production API Server • Traefik Reverse Proxy'
                      : item.service_type === 'frontend' || item.name?.includes('(Frontend)')
                      ? 'Production Web UI • Nginx Static Routing'
                      : 'Production Service • Docker Container';

                    return (
                      <tr key={item.id} className={`hover:bg-neutral-900/40 transition-colors group ${isMenuOpen ? 'relative z-30' : ''}`}>
                        {/* 1. Deployment / Project Name with Tooltip */}
                        <td className="px-4 py-3.5 max-w-[180px] sm:max-w-[220px] lg:max-w-[260px]">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-5 h-5 flex items-center justify-center shrink-0">
                              <svg viewBox="0 0 76 65" fill="none" stroke="currentColor" strokeWidth="8" strokeLinejoin="round" className="w-3.5 h-3.5 text-[#00df8f]">
                                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                              </svg>
                            </div>
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {item.domain_name && isRunning ? (
                                <a 
                                  href={`http://${item.domain_name}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  title={shortName}
                                  className="text-sm font-medium text-white hover:underline truncate tracking-tight font-sans block"
                                >
                                  {shortName}
                                </a>
                              ) : (
                                <span 
                                  title={shortName}
                                  className="text-sm font-medium text-white truncate tracking-tight font-sans block cursor-help"
                                >
                                  {shortName}
                                </span>
                              )}
                              {item.service_type === 'backend' || item.name?.includes('(Backend)') ? (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                                  API
                                </span>
                              ) : item.service_type === 'frontend' || item.name?.includes('(Frontend)') ? (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                                  UI
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        {/* 2. Description / Commit */}
                        <td className="hidden md:table-cell px-4 py-3.5 text-xs text-neutral-400 truncate max-w-[160px] lg:max-w-[240px] font-sans" title={description}>
                          {description}
                        </td>

                        {/* 3. Status */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {isUpdating ? (
                            <div className="flex items-center gap-2 text-xs font-mono text-blue-400">
                              <RefreshCw className="w-3 h-3 animate-spin text-blue-400 shrink-0" />
                              <span>Building</span>
                            </div>
                          ) : isCrashed ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (item.last_error) {
                                  setActiveErrorDetails(item.last_error);
                                  setActiveErrorContainerName(item.name);
                                  setErrorModalOpen(true);
                                } else {
                                  handleViewLogs(item.id, item.name);
                                }
                              }}
                              className="flex items-center gap-1.5 text-xs font-mono text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                              title="Click to view crash error"
                            >
                              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0"></span>
                              <span>Failed</span>
                              <span className="text-[10px] text-rose-300 bg-rose-950 border border-rose-900 px-1 py-0.2 rounded">
                                Logs
                              </span>
                            </button>
                          ) : isDbStopped ? (
                            <div className="flex items-center gap-1.5 text-xs font-mono text-amber-400">
                              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                              <span>DB Offline</span>
                            </div>
                          ) : isRunning ? (
                            <div className="flex items-center gap-1.5 text-xs font-mono">
                              <span className="w-2 h-2 rounded-full bg-[#00df8f] shadow-[0_0_8px_rgba(0,223,143,0.5)] shrink-0"></span>
                              <span className="text-white font-medium">Ready</span>
                              <span className="text-[#888888] font-mono text-[11px] ml-1">
                                {formatTimeAgo(item.deployed_at || item.created_at)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-500">
                              <span className="w-2 h-2 rounded-full bg-neutral-600 shrink-0"></span>
                              <span>Stopped</span>
                            </div>
                          )}
                        </td>

                        {/* 4. Environment */}
                        <td className="hidden sm:table-cell px-4 py-3.5 whitespace-nowrap">
                          {isRunning ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-[#0070f3] text-white shadow-[0_0_12px_rgba(0,112,243,0.25)]">
                              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                              Production
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono text-[#888888] border border-[#333333] bg-transparent">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#666666]"></span>
                              Production
                            </span>
                          )}
                        </td>

                        {/* 5. Commit */}
                        <td className="hidden lg:table-cell px-4 py-3.5 whitespace-nowrap font-mono text-xs text-[#888888]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[#666666] font-mono text-xs">-o-</span>
                            <span className="text-[#a1a1a1] hover:text-white transition-colors">{item.id ? item.id.substring(0, 7) : 'head'}</span>
                          </div>
                        </td>

                        {/* 6. Branch */}
                        <td className="hidden lg:table-cell px-4 py-3.5 whitespace-nowrap font-mono text-xs text-[#888888]">
                          <div className="flex items-center gap-1.5">
                            <GitBranch className="w-3.5 h-3.5 text-[#666666] shrink-0" />
                            <span className="text-[#a1a1a1] hover:text-white transition-colors">main</span>
                          </div>
                        </td>

                        {/* 7. Age */}
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-neutral-500">
                          {formatTimeAgo(item.deployed_at || item.created_at)}
                        </td>

                        {/* 8. Menu (...) & Visit & Avatar */}
                        <td className={`px-4 py-3.5 text-right whitespace-nowrap relative dropdown-menu-container ${isMenuOpen ? 'z-40' : ''}`}>
                          <div className="inline-flex items-center justify-end gap-2.5">
                            {/* Vercel Avatar with gradient border */}
                            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-500 p-[1.5px] shrink-0" title="Deployer: Kan">
                              <div className="w-full h-full bg-black rounded-full flex items-center justify-center text-[9px] font-mono font-bold text-white">
                                K
                              </div>
                            </div>
                            {item.domain_name && isRunning && (
                              <a
                                href={`http://${item.domain_name}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 rounded-md transition-colors"
                                title={`Visit http://${item.domain_name}`}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}

                            {/* 3-dots Menu Button */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(isMenuOpen ? null : item.id);
                                }}
                                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                  isMenuOpen
                                    ? 'bg-neutral-800 text-white border border-neutral-700'
                                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800'
                                }`}
                                title="More actions"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>

                              {/* Vercel Dropdown Menu */}
                              {isMenuOpen && (
                                <div 
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-full mt-1.5 w-48 bg-[#0a0a0a] border border-neutral-800 rounded-lg shadow-2xl z-50 py-1 text-left animate-in fade-in zoom-in-95 duration-100"
                                >
                                  {item.domain_name && isRunning && (
                                    <a
                                      href={`http://${item.domain_name}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={() => setActiveMenuId(null)}
                                      className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                                      <span>Visit Application</span>
                                    </a>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      handleViewLogs(item.id, item.name);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-neutral-400" />
                                    <span>View Logs</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      handleOpenEnv(item.id, item.name);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
                                  >
                                    <Settings className="w-3.5 h-3.5 text-neutral-400" />
                                    <span>Environment Variables</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      handleOpenWebhook(item);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
                                  >
                                    <Webhook className="w-3.5 h-3.5 text-neutral-400" />
                                    <span>Webhook CI/CD</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      handleRedeploy(item.id, item.name, item.image);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
                                    <span>Redeploy</span>
                                  </button>

                                  <div className="my-1 border-t border-neutral-900"></div>

                                  {isRunning ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        handleAction(item.id, 'stop', item.name);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-400 hover:bg-neutral-900 transition-colors cursor-pointer"
                                    >
                                      <Square className="w-3.5 h-3.5" />
                                      <span>Stop Service</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        handleAction(item.id, 'start', item.name);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-400 hover:bg-neutral-900 transition-colors cursor-pointer"
                                    >
                                      <Play className="w-3.5 h-3.5" />
                                      <span>Start Service</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      handleAction(item.id, 'delete', item.name);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete Service</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
      )}
      </div>
      )}

      {/* Tab 2: Storage & Databases (Managed PostgreSQL) */}
      {activeTab === 'storage' && (
        <div className="bg-[#0a0a0a] rounded-xl border border-neutral-800 overflow-hidden">
          <div className="p-6 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-neutral-950/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-neutral-900 text-neutral-300 border border-neutral-800 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-white tracking-tight">Managed PostgreSQL Instances</h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300">
                    v16.2
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400">
                    {databases.length} / 5 Active
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5 font-mono">
                  Dedicated isolated memory • Persistent Docker Volume storage
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
              <span className="w-2 h-2 rounded-full bg-[#00df8f] shadow-[0_0_8px_rgba(0,223,143,0.5)]"></span>
              <span>Cluster Online</span>
            </div>
          </div>

          {databases.length === 0 ? (
            <div className="p-16 text-center bg-black">
              <div className="w-12 h-12 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 flex items-center justify-center mx-auto mb-3">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-medium text-white mb-1">No Managed Databases yet</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto font-mono">
                Deploy a PostgreSQL 16 instance with 1 click, isolated memory, and persistent disk volume.
              </p>
              <button
                type="button"
                onClick={() => setCreateDbModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-black hover:bg-neutral-200 border border-white rounded-md text-xs font-medium transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Database</span>
              </button>
            </div>
          ) : (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {databases.map((db) => {
                const isRunning = db.status === 'running';
                return (
                  <div 
                    key={db.id}
                    className="p-5 rounded-lg border border-neutral-800 bg-black hover:border-neutral-700 transition-colors flex flex-col justify-between text-neutral-200"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-neutral-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                            <Database className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-white tracking-tight font-mono">
                              {db.name}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {isRunning ? (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#00df8f] shadow-[0_0_8px_rgba(0,223,143,0.5)]"></span>
                                  <span className="text-[11px] font-mono text-[#00df8f]">Ready</span>
                                </>
                              ) : (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-600"></span>
                                  <span className="text-[11px] font-mono text-neutral-500">Stopped</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions (Toggle/Delete) */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleDb(db.id, db.status)}
                            className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-colors cursor-pointer"
                            title={isRunning ? 'Stop Database' : 'Start Database'}
                          >
                            {isRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDb(db.id, db.name)}
                            className="p-1.5 rounded-md text-neutral-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/40 transition-colors cursor-pointer"
                            title="Delete Database"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Specs Tags (Vercel Style) */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[10px] font-mono">
                        <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
                          PostgreSQL 16
                        </span>
                        <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
                          Port {db.host_port}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                          512 MB Cap
                        </span>
                      </div>

                      {/* Live RAM Stats */}
                      {isRunning && stats[db.container_id] && (
                        <div className="mb-3 p-2.5 rounded-md bg-neutral-950 border border-neutral-800/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-neutral-400">RAM Usage</span>
                            <span className="text-white font-medium">
                              {Number(stats[db.container_id].memory_mb || 0).toFixed(1)} / {stats[db.container_id].memory_limit || 512} MB
                            </span>
                          </div>
                          <div className="w-full bg-neutral-900 rounded-full h-1 overflow-hidden border border-neutral-800">
                            <div 
                              className="bg-[#00df8f] h-1 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(3, ((Number(stats[db.container_id].memory_mb || 0) / (stats[db.container_id].memory_limit || 512)) * 100)))}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Unified Geist Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => handleOpenSqlStudio(db)}
                          disabled={!isRunning}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 text-neutral-200 hover:text-white rounded-md text-xs font-mono border border-neutral-800 transition-colors cursor-pointer"
                        >
                          <Code className="w-3.5 h-3.5 text-neutral-400" />
                          <span>SQL Studio</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenBindModal(db)}
                          disabled={!isRunning}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 text-neutral-200 hover:text-white rounded-md text-xs font-mono border border-neutral-800 transition-colors cursor-pointer"
                        >
                          <Link2 className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Bind Server</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => handleBackupDb(db)}
                          disabled={!isRunning || backingUpId === db.id}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 text-neutral-300 hover:text-white rounded-md text-xs font-mono border border-neutral-800 transition-colors cursor-pointer"
                          title="Download .sql backup"
                        >
                          <Download className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{backingUpId === db.id ? 'Exporting...' : 'Backup (.sql)'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenRestoreModal(db)}
                          disabled={!isRunning}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 text-neutral-300 hover:text-white rounded-md text-xs font-mono border border-neutral-800 transition-colors cursor-pointer"
                          title="Restore data from .sql"
                        >
                          <Upload className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Restore</span>
                        </button>
                      </div>

                      {/* Connection Strings (Clean Geist Dark Box) */}
                      <div className="space-y-2">
                        {/* Internal URL */}
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
                            <span>Internal URL (Apps)</span>
                            <button
                              type="button"
                              onClick={() => handleCopyUrl(db.internal_url, `internal-${db.id}`)}
                              className="inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white font-mono transition-colors cursor-pointer"
                            >
                              {copiedKey === `internal-${db.id}` ? (
                                <><Check className="w-3 h-3 text-[#00df8f]" /> Copied</>
                              ) : (
                                <><Copy className="w-3 h-3" /> Copy</>
                              )}
                            </button>
                          </div>
                          <div className="p-2 rounded bg-neutral-950 text-neutral-300 font-mono text-[11px] truncate select-all border border-neutral-800">
                            {db.internal_url}
                          </div>
                        </div>

                        {/* External URL */}
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
                            <span>External URL (TablePlus / DBeaver)</span>
                            <button
                              type="button"
                              onClick={() => handleCopyUrl(db.external_url, `external-${db.id}`)}
                              className="inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white font-mono transition-colors cursor-pointer"
                            >
                              {copiedKey === `external-${db.id}` ? (
                                <><Check className="w-3 h-3 text-[#00df8f]" /> Copied</>
                              ) : (
                                <><Copy className="w-3 h-3" /> Copy</>
                              )}
                            </button>
                          </div>
                          <div className="p-2 rounded bg-neutral-950 text-neutral-300 font-mono text-[11px] truncate select-all border border-neutral-800">
                            {db.external_url}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-neutral-900 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                      <span>DB: <code className="text-neutral-400 font-mono">{db.database_name}</code></span>
                      <span>User: <code className="text-neutral-400 font-mono">{db.username}</code></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Env Variables Modal */}
      {envModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0a0a] w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col text-white">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white tracking-tight">Environment Variables</h3>
                  <p className="text-xs text-neutral-400 font-mono">{activeEnvContainerName}</p>
                </div>
              </div>
              <button 
                onClick={() => setEnvModalOpen(false)} 
                className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {envError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{envError}</span>
                </div>
              )}

              {envSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-emerald-700 text-xs">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{envSuccess}</span>
                </div>
              )}

              <p className="text-xs text-neutral-400 font-mono">
                Add or edit environment variables (one per line, e.g. <code className="bg-slate-100 px-1 py-0.5 rounded text-neutral-300 font-mono">DB_URL=host=...</code>). The server will restart automatically:
              </p>

              <textarea 
                value={currentEnvText}
                onChange={(e) => setCurrentEnvText(e.target.value)}
                rows="7"
                disabled={envSaving}
                placeholder={"DB_URL=host=localhost user=postgres dbname=app\nPORT=8080\nAPI_KEY=secret123"}
                className="w-full px-4 py-3 rounded-md border border-neutral-800 bg-black text-white font-mono text-xs focus:border-neutral-600 focus:outline-none"
              ></textarea>
            </div>

            <div className="px-6 py-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEnvModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEnv}
                disabled={envSaving}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white hover:bg-neutral-200 disabled:opacity-50 text-black rounded-md text-xs font-medium border border-white transition-colors"
              >
                {envSaving ? 'Saving & Restarting...' : 'Save & Restart'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Modal */}
      {logModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-slate-700 flex flex-col h-[80vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
              <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-blue-400" />
                Logs: {activeContainerName}
              </h3>
              <button 
                onClick={() => setLogModalOpen(false)} 
                className="text-neutral-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-[#0d1117] font-mono text-sm text-slate-300">
              {logLoading ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <p className="text-neutral-400 animate-pulse">Fetching latest logs...</p>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words">{currentLogs}</pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Details Modal */}
      {errorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0a0a] w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col text-white">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white tracking-tight">Deployment Error Details</h3>
                  <p className="text-xs text-neutral-400 font-mono">{activeErrorContainerName}</p>
                </div>
              </div>
              <button 
                onClick={() => setErrorModalOpen(false)} 
                className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* 1. Highlighted Latest Root Cause Error on TOP */}
              {(() => {
                const rootCause = extractCrashRootCause(activeErrorDetails);
                return (
                  <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-200 font-mono text-xs flex items-start gap-3 shadow-inner">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-bold tracking-wider uppercase text-rose-400">
                          Latest Root Cause Error (ข้อผิดพลาดล่าสุด)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(rootCause);
                            toast.success("Error copied to clipboard");
                          }}
                          className="text-[10px] text-rose-300 hover:text-white flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded bg-rose-900/50 border border-rose-800 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                      </div>
                      <div className="font-semibold text-rose-100 text-xs break-words leading-relaxed">
                        {rootCause}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 2. Full Trace / Details */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-neutral-400 font-medium">Full Crash Log & Stack Trace:</p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(activeErrorDetails || '');
                      toast.success("Full logs copied to clipboard");
                    }}
                    className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Full Logs</span>
                  </button>
                </div>
                <div className="p-4 rounded-lg bg-black text-neutral-300 font-mono text-xs leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap break-words border border-neutral-800 shadow-inner">
                  {activeErrorDetails?.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '') || 'No details available'}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setErrorModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-neutral-200 text-black rounded-md text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Database Modal */}
      {createDbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0a0a] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col text-white">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-neutral-900 text-neutral-300 border border-neutral-800 border border-indigo-100">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white tracking-tight">Create Managed Database</h3>
                  <p className="text-xs text-neutral-400 font-mono">PostgreSQL 16 Alpine • Ready in 1-click</p>
                </div>
              </div>
              <button 
                onClick={() => setCreateDbModalOpen(false)} 
                className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDatabase}>
              <div className="p-6 space-y-4">
                {/* Database Name */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Database Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newDbName}
                    onChange={(e) => setNewDbName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="e.g. prod-db, my-app-db"
                    className="w-full px-3.5 py-2 rounded-md border border-neutral-800 bg-black text-white text-xs font-mono focus:border-neutral-600 focus:outline-none"
                    autoFocus
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Use lowercase alphanumeric characters, hyphens (-), and underscores (_)
                  </p>
                </div>

                {/* Resource Summary Specs Card */}
                <div className="p-3.5 rounded-md bg-neutral-950 border border-neutral-800 space-y-2">
                  <p className="text-xs font-semibold text-neutral-300">Specifications:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-md bg-black border border-neutral-800">
                      <div className="text-[10px] text-neutral-500 font-medium">RAM CAP</div>
                      <div className="text-xs font-bold text-indigo-600 mt-0.5">512 MB Max</div>
                    </div>
                    <div className="p-2 rounded-md bg-black border border-neutral-800">
                      <div className="text-[10px] text-neutral-500 font-medium">CPU LIMIT</div>
                      <div className="text-xs font-bold text-neutral-300 mt-0.5">1.0 Core</div>
                    </div>
                    <div className="p-2 rounded-md bg-black border border-neutral-800">
                      <div className="text-[10px] text-neutral-500 font-medium">STORAGE</div>
                      <div className="text-xs font-bold text-emerald-600 mt-0.5">Docker Volume</div>
                    </div>
                    <div className="p-2 rounded-md bg-black border border-neutral-800">
                      <div className="text-[10px] text-neutral-500 font-medium">NETWORK</div>
                      <div className="text-xs font-bold text-neutral-300 mt-0.5">ai-cloud-network</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-neutral-500 pt-0.5 leading-relaxed">
                    A persistent volume will be attached and an external port automatically allocated (from 5433).
                  </p>
                </div>
              </div>

              <div className="px-6 py-3.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateDbModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 rounded-md transition-colors hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingDb || !newDbName.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-neutral-200 disabled:opacity-40 text-black rounded-md text-xs font-medium border border-white transition-colors cursor-pointer"
                >
                  {creatingDb ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Database</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Web SQL Studio Modal */}
      {sqlModalOpen && activeSqlDb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0a0a] w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col max-h-[90vh] text-white">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-neutral-900 text-neutral-300 border border-neutral-800 border border-indigo-100">
                  <Database className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-white tracking-tight">SQL Studio</h3>
                  <span className="px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-neutral-800 font-mono text-xs">
                    {activeSqlDb.name}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-400 border border-neutral-800 font-mono text-xs">
                    PostgreSQL 16
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSqlModalOpen(false)} 
                className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 overflow-y-auto flex-1">
              {/* Tables Bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-neutral-400 text-xs flex items-center gap-1.5 shrink-0">
                  <Table className="w-3.5 h-3.5 text-indigo-600" />
                  Tables:
                </span>
                {sqlTables.length === 0 ? (
                  <span className="text-xs text-neutral-500 italic">No tables in database</span>
                ) : (
                  sqlTables.map((tbl) => (
                    <button
                      key={tbl}
                      type="button"
                      onClick={() => {
                        const query = `SELECT * FROM ${tbl} LIMIT 20;`;
                        setSqlQuery(query);
                        handleExecuteQuery(query);
                      }}
                      className="px-2.5 py-1 rounded-md bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 font-mono text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>{tbl}</span>
                    </button>
                  ))
                )}
              </div>

              {/* SQL Query Editor */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-neutral-300">
                    SQL Query:
                  </label>
                  <div className="flex items-center gap-2">
                    {sqlTables.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const query = `SELECT * FROM ${sqlTables[0]} LIMIT 20;`;
                          setSqlQuery(query);
                          handleExecuteQuery(query);
                        }}
                        className="text-[11px] text-neutral-400 hover:text-indigo-600 font-medium px-2 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        View {sqlTables[0]}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSqlQuery('')}
                      className="text-[11px] text-neutral-500 hover:text-rose-600 font-medium px-2 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleExecuteQuery();
                    }
                  }}
                  rows="3"
                  placeholder="Enter SQL query, e.g. SELECT * FROM ... or INSERT / UPDATE"
                  className="w-full px-3.5 py-2.5 rounded-md border border-neutral-800 font-mono text-xs text-neutral-100 bg-black focus:border-neutral-600 focus:outline-none leading-relaxed"
                ></textarea>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-neutral-500">
                    Press <kbd className="bg-neutral-900 px-1 py-0.5 rounded text-[10px] font-mono border border-neutral-800 text-neutral-400">⌘ + Enter</kbd> to run
                  </span>
                  <button
                    type="button"
                    onClick={() => handleExecuteQuery()}
                    disabled={runningSql || !sqlQuery.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-neutral-200 disabled:opacity-40 text-black rounded-md text-xs font-medium border border-white transition-colors cursor-pointer"
                  >
                    {runningSql ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Running...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Run Query</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* SQL Result View */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Result:
                </label>
                <div className="p-3.5 rounded-md bg-black text-emerald-400 font-mono text-xs leading-relaxed max-h-56 overflow-auto whitespace-pre border border-neutral-800">
                  {runningSql ? (
                    <span className="text-neutral-400">Loading data...</span>
                  ) : (
                    sqlResult || <span className="text-neutral-400">-- No rows returned --</span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleCopyUrl(activeSqlDb.external_url, `ext-sql-${activeSqlDb.id}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 transition-colors cursor-pointer"
              >
                {copiedKey === `ext-sql-${activeSqlDb.id}` ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Connection URL Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Connection URL</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSqlModalOpen(false)}
                className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 rounded-md text-xs font-medium transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bind Database to Server Modal */}
      {bindModalOpen && activeBindDb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0a0a] w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col text-white">
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-neutral-900 text-neutral-300 border border-neutral-800 border border-indigo-100">
                  <Link2 className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-white tracking-tight">Bind Database to Server</h3>
                  <span className="px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-neutral-800 font-mono text-xs">
                    {activeBindDb.name}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setBindModalOpen(false)} 
                className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-2">
                  Select Target Server:
                </label>
                {containers.filter(c => c.state === 'running').length === 0 ? (
                  <p className="text-xs text-rose-600 p-3 rounded-xl bg-rose-50 border border-rose-200">
                    No running servers found. Please start a server first.
                  </p>
                ) : (
                  <select
                    value={selectedTargetContainer}
                    onChange={(e) => setSelectedTargetContainer(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-md border border-neutral-800 bg-black text-xs font-mono text-neutral-200 focus:border-neutral-600 focus:outline-none transition-colors"
                  >
                    {containers.filter(c => c.state === 'running').map((c) => (
                      <option key={c.id} value={c.id}>
                        {getShortAppName(c.name, c.clean_name)} ({c.id.slice(0, 8)})
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[11px] text-neutral-500 mt-2 leading-relaxed">
                  The system will inject <code className="font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">DATABASE_URL</code> into the server and restart it automatically.
                </p>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setBindModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 rounded-md transition-colors hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBind}
                disabled={bindingServer || !selectedTargetContainer}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-neutral-200 disabled:opacity-40 text-black rounded-md text-xs font-medium border border-white transition-colors cursor-pointer"
              >
                {bindingServer ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Binding...</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Bind to Server</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Restore Database Modal */}
      {restoreModalOpen && activeRestoreDb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0a0a] w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col text-white">
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-white tracking-tight">Restore Database</h3>
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-mono text-xs font-semibold">
                    {activeRestoreDb.name}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setRestoreModalOpen(false)} 
                className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                SQL statements in the file will be executed directly against the database. Please verify your backup file.
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-2">
                  Select backup file (.sql):
                </label>
                <input
                  type="file"
                  accept=".sql,.dump"
                  onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-neutral-400 font-mono file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-mono file:bg-neutral-800 file:text-white hover:file:bg-neutral-700 border border-neutral-800 rounded-md p-1 bg-black cursor-pointer"
                />
                {restoreFile && (
                  <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                    Selected file: {restoreFile.name} ({(restoreFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {restoreResult && (
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-neutral-400">Execution output:</span>
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] max-h-36 overflow-y-auto whitespace-pre-wrap">
                    {restoreResult}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 rounded-md transition-colors hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={restoring || !restoreFile}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-neutral-200 disabled:opacity-40 text-black rounded-md text-xs font-medium border border-white transition-colors cursor-pointer"
              >
                {restoring ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Restoring...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Restore Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* GitHub Webhook Setup Modal */}
      {webhookModalOpen && activeWebhookContainer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0a0a] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col text-white">
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-neutral-800 bg-neutral-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
                  <Webhook className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-white tracking-tight">Webhook Auto-Deploy</h3>
                  <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-mono text-xs font-semibold">
                    {getShortAppName(activeWebhookContainer.name, activeWebhookContainer.clean_name)}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setWebhookModalOpen(false)} 
                className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Step 1: Payload URL */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300 mb-1.5">
                  <span>1. Payload URL:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const urlToCopy = activeWebhookContainer 
                        ? (customPublicUrl.trim() 
                            ? `${customPublicUrl.trim().replace(/\/$/, '')}/api/webhooks/deploy/${activeWebhookContainer.deployment_id}`
                            : activeWebhookContainer.webhook_url)
                        : '';
                      handleCopyUrl(urlToCopy, `wh-url-${activeWebhookContainer.deployment_id}`);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-700 font-medium cursor-pointer"
                  >
                    {copiedKey === `wh-url-${activeWebhookContainer.deployment_id}` ? (
                      <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copied</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /> Copy URL</>
                    )}
                  </button>
                </div>
                <div className="p-2.5 rounded-md bg-black text-neutral-200 font-mono text-xs select-all border border-neutral-800 break-all">
                  {activeWebhookContainer && (customPublicUrl.trim() 
                    ? `${customPublicUrl.trim().replace(/\/$/, '')}/api/webhooks/deploy/${activeWebhookContainer.deployment_id}`
                    : activeWebhookContainer.webhook_url)}
                </div>

                {/* Localhost Tunnel Helper */}
                <div className="mt-2.5 p-3 rounded-md bg-neutral-950 border border-neutral-800 text-xs space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400 font-medium">Public Tunnel Command (for Localhost):</span>
                    <button
                      type="button"
                      onClick={() => handleCopyUrl('npx localtunnel --port 8080', 'cmd-localtunnel')}
                      className="text-purple-700 hover:text-purple-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'cmd-localtunnel' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      Copy Command
                    </button>
                  </div>
                  <div className="p-2 bg-black rounded-md border border-neutral-800 font-mono text-[11px] text-neutral-300">
                    <code>npx localtunnel --port 8080</code>
                  </div>
                  <input
                    type="text"
                    value={customPublicUrl}
                    onChange={(e) => handleUpdatePublicUrl(e.target.value)}
                    placeholder="Paste your Public URL, e.g. https://xxxx.loca.lt"
                    className="w-full px-3 py-1.5 rounded-md border border-neutral-800 bg-black text-xs font-mono text-neutral-200 focus:outline-none focus:border-neutral-600"
                  />
                </div>
              </div>

              {/* Step 2 & 3 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-xs font-semibold text-neutral-300 mb-1.5">2. Content type:</span>
                  <div className="p-2.5 rounded-md bg-black text-neutral-300 font-mono text-xs border border-neutral-800">
                    application/json
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-300 mb-1.5">
                    <span>3. Secret:</span>
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(activeWebhookContainer.webhook_secret, `wh-sec-${activeWebhookContainer.deployment_id}`)}
                      className="inline-flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-700 font-medium cursor-pointer"
                    >
                      {copiedKey === `wh-sec-${activeWebhookContainer.deployment_id}` ? (
                        <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copied</>
                      ) : (
                        <><Copy className="w-3.5 h-3.5" /> Copy</>
                      )}
                    </button>
                  </div>
                  <div className="p-2.5 rounded-md bg-black text-neutral-300 font-mono text-xs truncate border border-neutral-800">
                    {activeWebhookContainer.webhook_secret}
                  </div>
                </div>
              </div>

              {/* Step 4: Event */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-neutral-400 flex items-center justify-between">
                <span className="font-medium text-neutral-300">4. Event:</span>
                <span className="font-semibold text-indigo-700">Just the push event</span>
              </div>

              {/* GitHub Link Guide */}
              {activeWebhookContainer.clean_name?.startsWith('http') && (
                <div className="text-right">
                  <a
                    href={`${activeWebhookContainer.clean_name.replace(/\.git$/, '')}/settings/hooks`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium underline"
                  >
                    <span>Open GitHub Webhook Settings</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestWebhookPing}
                disabled={pingingWebhook}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-md text-xs font-mono border border-neutral-800 transition-colors cursor-pointer"
              >
                {pingingWebhook ? (
                  <>
                    <div className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <Webhook className="w-3.5 h-3.5" />
                    <span>Send Test Ping</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setWebhookModalOpen(false)}
                className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 rounded-md text-xs font-medium transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0a0a] w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col text-white p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className={`p-3 rounded-2xl shrink-0 ${
                confirmModal.variant === 'danger' 
                  ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                  : confirmModal.variant === 'warning'
                  ? 'bg-amber-50 text-amber-600 border border-amber-100'
                  : 'bg-neutral-900 text-neutral-300 border border-neutral-800 border border-indigo-100'
              }`}>
                {confirmModal.variant === 'danger' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : confirmModal.variant === 'warning' ? (
                  <AlertCircle className="w-6 h-6" />
                ) : (
                  <RefreshCw className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-white tracking-tight">{confirmModal.title}</h3>
                <p className="text-xs text-neutral-400 font-mono mt-1.5 leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 rounded-md transition-colors hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                {confirmModal.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirmModal.onConfirm;
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  if (action) action();
                }}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md text-white transition-colors cursor-pointer flex items-center gap-1.5 ${
                  confirmModal.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                    : confirmModal.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                }`}
              >
                {confirmModal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHome;
