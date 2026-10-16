import { useState, useEffect, useCallback, useRef } from 'react';
import { Server, Play, Square, Trash2, ExternalLink, Activity, Box, Terminal, FileText, X, Cpu, HardDrive, RefreshCw, AlertTriangle, Settings, AlertCircle, CheckCircle2, Layers, Globe, Database, Bell, BellRing, Sparkles, Copy, Check, Plus, Link2, Table, Code, Search, Download, Upload, GitBranch, Webhook, Clock, Send } from 'lucide-react';
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
  const [containers, setContainers] = useState([]);
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
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-blue-200 rounded-full animate-ping"></div>
        <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
      </div>
      <p className="text-slate-500 font-medium animate-pulse">Connecting to Docker Engine...</p>
    </div>
  );

  const crashedContainers = containers.filter(c => c.state === 'exited' || c.state === 'failed' || c.state === 'restarting');
  const dbDisconnectedContainers = containers.filter(c => c.state === 'running' && c.is_db_stopped);

  return (
    <>
      <div className="bg-white/70 backdrop-blur-2xl p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 relative overflow-hidden">
      {/* Decorative Blob */}
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent flex items-center gap-2">
            <Server className="w-6 h-6 text-blue-500" />
            Active Servers
          </h3>
          <p className="text-slate-500 text-sm mt-1">Manage your deployed applications and microservices.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={requestNotificationPermission}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              notificationsEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title={notificationsEnabled ? 'Desktop alerts enabled' : 'Click to enable desktop alerts when servers stop'}
          >
            {notificationsEnabled ? (
              <BellRing className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Bell className="w-3.5 h-3.5 text-slate-400" />
            )}
            {notificationsEnabled ? 'Desktop Alerts: On' : 'Enable Desktop Alerts'}
          </button>

          <span className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-1.5 rounded-full shadow-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            Running: {containers.filter(c => c.state === 'running').length} / {containers.length}
          </span>
        </div>
      </div>

      {/* Alert Banner for stopped/crashed servers */}
      {crashedContainers.length > 0 && !dismissAlert && (
        <div className="relative z-10 mb-6 p-4 rounded-2xl bg-rose-50/90 border border-rose-200 shadow-xs flex items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 rounded-xl text-rose-600 shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-semibold text-rose-950 text-sm">
                Servers stopped ({crashedContainers.length} service{crashedContainers.length > 1 ? 's' : ''})
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Click <span className="font-semibold text-rose-800">[Logs]</span> in the table to view error details, or click start to resume.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissAlert(true)}
            className="text-slate-400 hover:text-slate-600 hover:bg-rose-100/60 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Alert Banner for disconnected databases */}
      {dbDisconnectedContainers.length > 0 && !dismissDbAlert && (
        <div className="relative z-10 mb-6 p-4 rounded-2xl bg-amber-50/95 border border-amber-300 shadow-xs flex items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0">
              <Database className="w-5 h-5 animate-pulse text-amber-600" />
            </div>
            <div>
              <h4 className="font-semibold text-amber-950 text-sm">
                Database offline ({dbDisconnectedContainers.length} service{dbDisconnectedContainers.length > 1 ? 's' : ''} affected)
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Database <span className="font-bold">({dbDisconnectedContainers[0].linked_db_name || 'Database'})</span> is offline. Services may return 500 errors.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {dbDisconnectedContainers[0]?.linked_db_id && (
              <button
                onClick={() => handleToggleDb(dbDisconnectedContainers[0].linked_db_id, 'stopped')}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Database Now
              </button>
            )}
            <button
              onClick={() => setDismissDbAlert(true)}
              className="text-slate-400 hover:text-slate-600 hover:bg-amber-100/60 p-1.5 rounded-lg transition-colors cursor-pointer"
              title="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {containers.length === 0 ? (
        <div className="text-center py-20 bg-slate-50/50 rounded-3xl border border-slate-100/50 backdrop-blur-sm relative z-10">
          <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-6 border border-slate-100">
            <Box className="w-10 h-10 text-slate-300" />
          </div>
          <h4 className="text-xl font-semibold text-slate-700 mb-2">No servers deployed yet</h4>
          <p className="text-slate-500 max-w-sm mx-auto">
            Your dashboard is looking a bit empty. Head over to the New Deploy menu to launch your first application.
          </p>
        </div>
      ) : (
        <div className="relative z-10">
          <div className="w-full">
            <div className="overflow-hidden bg-white border border-slate-200 shadow-sm rounded-2xl">
              <table className="w-full table-auto divide-y divide-slate-200">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">ID</th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Service / App</th>
                    <th scope="col" className="hidden lg:table-cell px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">Image</th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Status</th>
                    <th scope="col" className="hidden sm:table-cell px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">Last Deployed</th>
                    <th scope="col" className="hidden md:table-cell px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Usage</th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32 whitespace-nowrap">URL</th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {containers.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors duration-200 group">
                      {/* ID */}
                      <td className="px-3 py-3">
                        <div className="flex items-center text-xs font-mono text-slate-500">
                          <Terminal className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[50px]" title={item.id}>{item.id ? item.id.substring(0, 7) : '-'}</span>
                        </div>
                      </td>

                      {/* Service / App */}
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.service_type === 'backend' || item.name?.includes('(Backend)') ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <Database className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                Backend API
                              </span>
                            ) : item.service_type === 'frontend' || item.name?.includes('(Frontend)') ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800 border border-purple-300">
                                <Globe className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                                Frontend UI
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                                <Layers className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                                Service
                              </span>
                            )}

                            <span 
                              className="text-xs font-bold text-slate-900 tracking-tight" 
                              title={`Repository: ${item.name}`}
                            >
                              {getShortAppName(item.name, item.clean_name)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5 flex-wrap">
                            <span>
                              {item.service_type === 'backend' || item.name?.includes('(Backend)') 
                                ? 'API Server' 
                                : item.service_type === 'frontend' || item.name?.includes('(Frontend)')
                                ? 'Web UI'
                                : 'Standalone'}
                            </span>
                            <span>•</span>
                            <span 
                              className="inline-flex items-center gap-1 text-slate-600 font-sans font-medium bg-slate-100/90 px-1.5 py-0.5 rounded border border-slate-200/60"
                              title={item.deployed_at ? `Last deployed: ${new Date(item.deployed_at).toLocaleString('en-US')}` : ''}
                            >
                              <Clock className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                              <span>{formatTimeAgo(item.deployed_at || item.updated_at || item.created_at)}</span>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Image (hidden on small screens) */}
                      <td className="hidden lg:table-cell px-3 py-3">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-600 bg-slate-100 border border-slate-200 truncate max-w-[130px]" title={item.image}>
                          {item.image || '-'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3">
                        {item.state === 'redeploying' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap shadow-2xs">
                            <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                            Updating
                          </span>
                        ) : item.state === 'failed' || item.last_error || item.state === 'exited' || item.state === 'restarting' ? (
                          <button
                            onClick={() => {
                              if (item.last_error) {
                                setActiveErrorDetails(item.last_error);
                                setActiveErrorContainerName(item.name);
                                setErrorModalOpen(true);
                              } else {
                                handleViewLogs(item.id, item.name);
                              }
                            }}
                            className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
                            title="Click to view crash logs"
                          >
                            <span className="relative flex h-1.5 w-1.5 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                            </span>
                            <span>{item.state === 'restarting' ? 'Crash Loop' : 'Crashed'}</span>
                            <span className="text-[10px] bg-rose-200/70 group-hover:bg-rose-300 px-1.5 py-0.2 rounded-full font-medium text-rose-800 transition-colors">
                              Logs
                            </span>
                          </button>
                        ) : item.state === 'running' && item.is_db_stopped ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span 
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap shadow-2xs bg-amber-50 text-amber-800 border-amber-300"
                              title={item.db_warning || `Cannot connect to ${item.linked_db_name || 'database'}; database is stopped`}
                            >
                              <span className="relative flex h-1.5 w-1.5 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                              </span>
                              <span>DB Offline</span>
                            </span>
                            {item.linked_db_id && (
                              <button
                                onClick={() => handleToggleDb(item.linked_db_id, 'stopped')}
                                className="text-[10px] text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 font-semibold px-2 py-0.5 rounded border border-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
                                title="Click to start database"
                              >
                                <Play className="w-2.5 h-2.5 fill-current" /> Start DB
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap shadow-2xs
                            ${item.state === 'running' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {item.state === 'running' ? (
                              <span className="relative flex h-1.5 w-1.5 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                              </span>
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0"></span>
                            )}
                            {item.state === 'running' ? 'Running' : 'Stopped'}
                          </span>
                        )}
                      </td>

                      {/* Last Deployed (Last Deployed) */}
                      <td className="hidden sm:table-cell px-3 py-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                            <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span>{formatTimeAgo(item.deployed_at || item.updated_at || item.created_at)}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5 ml-5">
                            {formatDateTime(item.deployed_at || item.updated_at || item.created_at)}
                          </span>
                        </div>
                      </td>

                      {/* Resources (hidden on mobile) */}
                      <td className="hidden md:table-cell px-3 py-3">
                        {item.state === 'running' && stats[item.id] ? (
                          <div className="flex flex-col gap-0.5 text-[10px] font-mono text-slate-500">
                            <div className="flex items-center gap-1">
                              <Cpu className="w-3 h-3 text-indigo-400 shrink-0" />
                              <span className={stats[item.id].cpu_percent > 80 ? 'text-rose-500 font-semibold' : ''}>
                                {stats[item.id].cpu_percent.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>
                                {stats[item.id].memory_mb.toFixed(0)}MB
                              </span>
                            </div>
                          </div>
                        ) : item.state === 'running' ? (
                          <div className="text-[10px] text-slate-400 animate-pulse font-mono">Loading...</div>
                        ) : (
                          <div className="text-[10px] text-slate-400 font-mono">-</div>
                        )}
                      </td>

                      {/* URL */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {item.state === 'running' && item.domain_name ? (
                          (item.service_type === 'backend' || item.name?.includes('(Backend)')) ? (
                            <div className="inline-flex items-center gap-1 whitespace-nowrap">
                              <button 
                                type="button"
                                onClick={() => handleCopyApiUrl(`http://${item.domain_name}`, `app-url-${item.id}`)}
                                className={`inline-flex items-center gap-1 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors px-2 py-0.5 rounded-md cursor-pointer ${
                                  copiedKey === `app-url-${item.id}`
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                }`}
                                title={`Click to copy API URL: http://${item.domain_name}`}
                              >
                                {copiedKey === `app-url-${item.id}` ? (
                                  <>
                                    <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                    <span>Copy URL</span>
                                  </>
                                )}
                              </button>
                              <a 
                                href={`http://${item.domain_name}`} 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                                title="Open in browser"
                              >
                                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                              </a>
                            </div>
                          ) : (
                            <a 
                              href={`http://${item.domain_name}`} 
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium whitespace-nowrap shrink-0 text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md"
                            >
                              Visit <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            </a>
                          )
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Offline</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          {item.state === 'running' ? (
                            <div className="relative group/tip flex items-center justify-center">
                              <button 
                                onClick={() => handleAction(item.id, 'stop', item.name)} 
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                aria-label="Stop Server"
                              >
                                <Square className="w-3.5 h-3.5 fill-current" />
                              </button>
                              <div className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 px-2 py-1 bg-slate-900 text-white text-[10px] font-medium rounded-md shadow-lg whitespace-nowrap z-30">
                                Stop Server
                              </div>
                            </div>
                          ) : (
                            <div className="relative group/tip flex items-center justify-center">
                              <button 
                                onClick={() => handleAction(item.id, 'start', item.name)} 
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                                aria-label="Start Server"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>
                              <div className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 px-2 py-1 bg-slate-900 text-white text-[10px] font-medium rounded-md shadow-lg whitespace-nowrap z-30">
                                Start Server
                              </div>
                            </div>
                          )}

                          <div className="relative group/tip flex items-center justify-center">
                            <button 
                              onClick={() => handleViewLogs(item.id, item.name)} 
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              aria-label="View Logs"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <div className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 px-2 py-1 bg-slate-900 text-white text-[10px] font-medium rounded-md shadow-lg whitespace-nowrap z-30">
                              View Logs
                            </div>
                          </div>

                          <div className="relative group/tip flex items-center justify-center">
                            <button 
                              onClick={() => handleOpenEnv(item.id, item.name)} 
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                              aria-label="Environment Variables (.env)"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                            <div className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 px-2 py-1 bg-slate-900 text-white text-[10px] font-medium rounded-md shadow-lg whitespace-nowrap z-30">
                              Environment (.env)
                            </div>
                          </div>

                          <div className="relative group/tip flex items-center justify-center">
                            <button
                              onClick={() => {handleRedeploy(item.id)}}
                              className="p-1.5 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                              aria-label="Re-deploy Server"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <div className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 px-2 py-1 bg-slate-900 text-white text-[10px] font-medium rounded-md shadow-lg whitespace-nowrap z-30">
                              Re-deploy
                            </div>
                          </div>

                          <div className="relative group/tip flex items-center justify-center">
                            <button
                              onClick={() => handleOpenWebhookModal(item)}
                              className="p-1.5 rounded-lg text-purple-600 hover:text-purple-800 hover:bg-purple-50 transition-colors cursor-pointer"
                              aria-label="Auto-Deploy (Webhook)"
                            >
                              <Webhook className="w-3.5 h-3.5" />
                            </button>
                            <div className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 px-2 py-1 bg-slate-900 text-white text-[10px] font-medium rounded-md shadow-lg whitespace-nowrap z-30">
                              Auto-Deploy (Webhook)
                            </div>
                          </div>

                          <div className="relative group/tip flex items-center justify-center">
                            <button 
                              onClick={() => handleDelete(item.id || item.deployment_id)} 
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              aria-label="Delete Server"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <div className="pointer-events-none absolute bottom-full mb-1.5 right-0 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 px-2 py-1 bg-rose-950 text-white text-[10px] font-medium rounded-md shadow-lg whitespace-nowrap z-30">
                              Delete Server
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Managed Databases Section */}
      <div className="mt-10">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-800">Managed Databases</h2>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    PostgreSQL 16
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {databases.length} / 5 DBs
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Instant PostgreSQL • 512 MB RAM limit per instance • Persistent Volume storage
                </p>
              </div>
            </div>

            <button
              onClick={() => setCreateDbModalOpen(true)}
              disabled={databases.length >= 5}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Create Database</span>
            </button>
          </div>

          {databases.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-3">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">No Managed Databases yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Deploy a PostgreSQL 16 database for your applications in 1 click with isolated resources and persistent storage.
              </p>
              <button
                onClick={() => setCreateDbModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition-all"
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
                    className="p-5 rounded-xl border border-slate-200/90 bg-slate-50/40 hover:bg-white hover:border-indigo-200 transition-all shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl ${isRunning ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <Database className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                              {db.name}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`inline-block w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                              <span className="text-[11px] font-medium text-slate-500 capitalize">{db.status}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <div className="relative group/tip flex items-center justify-center">
                            <button
                              onClick={() => handleToggleDb(db.id, db.status)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isRunning 
                                  ? 'text-amber-600 hover:bg-amber-50' 
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              aria-label={isRunning ? 'Stop Database' : 'Start Database'}
                            >
                              {isRunning ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                            </button>
                            <div className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 px-2 py-1 bg-slate-900 text-white text-[10px] font-medium rounded-md shadow-lg whitespace-nowrap z-30">
                              {isRunning ? 'Stop Database' : 'Start Database'}
                            </div>
                          </div>

                          <div className="relative group/tip flex items-center justify-center">
                            <button
                              onClick={() => handleDeleteDb(db.id, db.name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              aria-label='Delete Database'
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <div className="pointer-events-none absolute bottom-full mb-1.5 right-0 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 px-2 py-1 bg-rose-950 text-white text-[10px] font-medium rounded-md shadow-lg whitespace-nowrap z-30">
                              Delete Database
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Specs Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-4 text-[10px] font-semibold text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100/60">
                          RAM: 512 MB
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100/60">
                          Port: {db.host_port}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          Volume: Persistent
                        </span>
                      </div>

                      {/* Live RAM Stats */}
                      {isRunning && stats[db.container_id] && (
                        <div className="mb-3.5 p-2.5 rounded-xl bg-white border border-slate-200/70 shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                              <Activity className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                              <span>Actual RAM:</span>
                            </div>
                            <span className="font-mono font-bold text-slate-700">
                              {Number(stats[db.container_id].memory_mb || 0).toFixed(1)} MB / {stats[db.container_id].memory_limit || 512} MB
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-indigo-500 to-blue-500 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(3, ((Number(stats[db.container_id].memory_mb || 0) / (stats[db.container_id].memory_limit || 512)) * 100)))}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Database Quick Tools */}
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => handleOpenSqlStudio(db)}
                          disabled={!isRunning}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200/60 transition-colors cursor-pointer"
                        >
                          <Code className="w-3.5 h-3.5" />
                          <span>SQL Studio</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenBindModal(db)}
                          disabled={!isRunning}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 disabled:opacity-40 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200/60 transition-colors cursor-pointer"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>Bind to Server</span>
                        </button>
                      </div>

                      {/* Backup & Restore Tools */}
                      <div className="grid grid-cols-2 gap-2 mb-3.5">
                        <button
                          type="button"
                          onClick={() => handleBackupDb(db)}
                          disabled={!isRunning || backingUpId === db.id}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-200/60 transition-colors cursor-pointer"
                          title="Download .sql backup file"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{backingUpId === db.id ? 'Exporting...' : 'Backup (.sql)'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenRestoreModal(db)}
                          disabled={!isRunning}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-800 rounded-lg text-xs font-semibold border border-amber-200/60 transition-colors cursor-pointer"
                          title="Upload .sql file to restore data"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>
                      </div>

                      {/* Connection Strings */}
                      <div className="space-y-2.5">
                        {/* Internal URL */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                            <span className="font-medium text-indigo-700">Internal URL (for in-network apps):</span>
                            <button
                              onClick={() => handleCopyUrl(db.internal_url, `internal-${db.id}`)}
                              className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-600 font-medium"
                            >
                              {copiedKey === `internal-${db.id}` ? (
                                <><Check className="w-3 h-3 text-emerald-600" /> Copied</>
                              ) : (
                                <><Copy className="w-3 h-3" /> Copy</>
                              )}
                            </button>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-900 text-slate-300 font-mono text-[11px] truncate select-all border border-slate-800">
                            {db.internal_url}
                          </div>
                        </div>

                        {/* External URL */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                            <span className="font-medium text-slate-600">External URL (DBeaver / TablePlus):</span>
                            <button
                              onClick={() => handleCopyUrl(db.external_url, `external-${db.id}`)}
                              className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-600 font-medium"
                            >
                              {copiedKey === `external-${db.id}` ? (
                                <><Check className="w-3 h-3 text-emerald-600" /> Copied</>
                              ) : (
                                <><Copy className="w-3 h-3" /> Copy</>
                              )}
                            </button>
                          </div>
                          <div className="p-2 rounded-lg bg-white text-slate-700 font-mono text-[11px] truncate select-all border border-slate-200 shadow-inner">
                            {db.external_url}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                      <span>DB: <code className="text-slate-600 font-mono">{db.database_name}</code></span>
                      <span>User: <code className="text-slate-600 font-mono">{db.username}</code></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Env Variables Modal */}
      {envModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Environment Variables</h3>
                  <p className="text-xs text-slate-500">{activeEnvContainerName}</p>
                </div>
              </div>
              <button 
                onClick={() => setEnvModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60"
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

              <p className="text-xs text-slate-500">
                Add or edit environment variables (one per line, e.g. <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">DB_URL=host=...</code>). The server will restart automatically:
              </p>

              <textarea 
                value={currentEnvText}
                onChange={(e) => setCurrentEnvText(e.target.value)}
                rows="7"
                disabled={envSaving}
                placeholder={"DB_URL=host=localhost user=postgres dbname=app\nPORT=8080\nAPI_KEY=secret123"}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              ></textarea>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEnvModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEnv}
                disabled={envSaving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20"
              >
                {envSaving ? 'Saving & Restarting...' : 'Save & Restart'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Modal */}
      {logModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-slate-700 flex flex-col h-[80vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
              <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-blue-400" />
                Logs: {activeContainerName}
              </h3>
              <button 
                onClick={() => setLogModalOpen(false)} 
                className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-[#0d1117] font-mono text-sm text-slate-300">
              {logLoading ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <p className="text-slate-500 animate-pulse">Fetching latest logs...</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-rose-200 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-rose-100 bg-rose-50/80">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Deployment Error Details</h3>
                  <p className="text-xs text-slate-500">{activeErrorContainerName}</p>
                </div>
              </div>
              <button 
                onClick={() => setErrorModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-xs text-slate-600 font-medium">System error message:</p>
              <div className="p-4 rounded-xl bg-slate-900 text-rose-300 font-mono text-xs leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap break-words border border-slate-800 shadow-inner">
                {activeErrorDetails}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setErrorModalOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Database Modal */}
      {createDbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Create Managed Database</h3>
                  <p className="text-xs text-slate-500">PostgreSQL 16 Alpine • Ready in 1-click</p>
                </div>
              </div>
              <button 
                onClick={() => setCreateDbModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDatabase}>
              <div className="p-6 space-y-4">
                {/* Database Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Database Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newDbName}
                    onChange={(e) => setNewDbName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="e.g. prod-db, my-app-db"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Use lowercase alphanumeric characters, hyphens (-), and underscores (_)
                  </p>
                </div>

                {/* Resource Summary Specs Card */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Specifications:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-white border border-slate-200/60">
                      <div className="text-[10px] text-slate-400 font-medium">RAM CAP</div>
                      <div className="text-xs font-bold text-indigo-600 mt-0.5">512 MB Max</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200/60">
                      <div className="text-[10px] text-slate-400 font-medium">CPU LIMIT</div>
                      <div className="text-xs font-bold text-slate-700 mt-0.5">1.0 Core</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200/60">
                      <div className="text-[10px] text-slate-400 font-medium">STORAGE</div>
                      <div className="text-xs font-bold text-emerald-600 mt-0.5">Docker Volume</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200/60">
                      <div className="text-[10px] text-slate-400 font-medium">NETWORK</div>
                      <div className="text-xs font-bold text-slate-700 mt-0.5">ai-cloud-network</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-0.5 leading-relaxed">
                    A persistent volume will be attached and an external port automatically allocated (from 5433).
                  </p>
                </div>
              </div>

              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateDbModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingDb || !newDbName.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
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
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Database className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-800">SQL Studio</h3>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100/70 text-indigo-700 font-mono text-xs font-semibold">
                    {activeSqlDb.name}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium">
                    PostgreSQL 16
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSqlModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 overflow-y-auto flex-1">
              {/* Tables Bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-500 text-xs flex items-center gap-1.5 shrink-0">
                  <Table className="w-3.5 h-3.5 text-indigo-600" />
                  Tables:
                </span>
                {sqlTables.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">No tables in database</span>
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
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200/80 font-mono text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
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
                  <label className="text-xs font-semibold text-slate-700">
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
                        className="text-[11px] text-slate-500 hover:text-indigo-600 font-medium px-2 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        View {sqlTables[0]}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSqlQuery('')}
                      className="text-[11px] text-slate-400 hover:text-rose-600 font-medium px-2 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
                ></textarea>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-slate-400">
                    Press <kbd className="bg-slate-100 px-1 py-0.5 rounded text-[10px] font-mono border border-slate-200">⌘ + Enter</kbd> to run
                  </span>
                  <button
                    type="button"
                    onClick={() => handleExecuteQuery()}
                    disabled={runningSql || !sqlQuery.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Result:
                </label>
                <div className="p-3.5 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs leading-relaxed max-h-56 overflow-auto whitespace-pre border border-slate-800 shadow-inner">
                  {runningSql ? (
                    <span className="text-slate-500">Loading data...</span>
                  ) : (
                    sqlResult || <span className="text-slate-600">-- No rows returned --</span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleCopyUrl(activeSqlDb.external_url, `ext-sql-${activeSqlDb.id}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-200/60 border border-slate-200 transition-colors cursor-pointer"
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
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bind Database to Server Modal */}
      {bindModalOpen && activeBindDb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Link2 className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-800">Bind Database to Server</h3>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100/70 text-indigo-700 font-mono text-xs font-semibold">
                    {activeBindDb.name}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setBindModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                  >
                    {containers.filter(c => c.state === 'running').map((c) => (
                      <option key={c.id} value={c.id}>
                        {getShortAppName(c.name, c.clean_name)} ({c.id.slice(0, 8)})
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  The system will inject <code className="font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">DATABASE_URL</code> into the server and restart it automatically.
                </p>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setBindModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBind}
                disabled={bindingServer || !selectedTargetContainer}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-800">Restore Database</h3>
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-mono text-xs font-semibold">
                    {activeRestoreDb.name}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setRestoreModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                SQL statements in the file will be executed directly against the database. Please verify your backup file.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Select backup file (.sql):
                </label>
                <input
                  type="file"
                  accept=".sql,.dump"
                  onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 border border-slate-200 rounded-xl p-1 bg-slate-50 cursor-pointer"
                />
                {restoreFile && (
                  <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                    Selected file: {restoreFile.name} ({(restoreFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {restoreResult && (
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600">Execution output:</span>
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] max-h-36 overflow-y-auto whitespace-pre-wrap">
                    {restoreResult}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={restoring || !restoreFile}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
                  <Webhook className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-800">Webhook Auto-Deploy</h3>
                  <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-mono text-xs font-semibold">
                    {getShortAppName(activeWebhookContainer.name, activeWebhookContainer.clean_name)}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setWebhookModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Step 1: Payload URL */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
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
                <div className="p-2.5 rounded-xl bg-slate-900 text-purple-300 font-mono text-xs select-all border border-slate-800 break-all">
                  {activeWebhookContainer && (customPublicUrl.trim() 
                    ? `${customPublicUrl.trim().replace(/\/$/, '')}/api/webhooks/deploy/${activeWebhookContainer.deployment_id}`
                    : activeWebhookContainer.webhook_url)}
                </div>

                {/* Localhost Tunnel Helper */}
                <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 font-medium">Public Tunnel Command (for Localhost):</span>
                    <button
                      type="button"
                      onClick={() => handleCopyUrl('npx localtunnel --port 8080', 'cmd-localtunnel')}
                      className="text-purple-700 hover:text-purple-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'cmd-localtunnel' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      Copy Command
                    </button>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-[11px] text-slate-800">
                    <code>npx localtunnel --port 8080</code>
                  </div>
                  <input
                    type="text"
                    value={customPublicUrl}
                    onChange={(e) => handleUpdatePublicUrl(e.target.value)}
                    placeholder="Paste your Public URL, e.g. https://xxxx.loca.lt"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Step 2 & 3 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-1.5">2. Content type:</span>
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800 font-mono text-xs font-bold border border-slate-200">
                    application/json
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
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
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800 font-mono text-xs truncate border border-slate-200">
                    {activeWebhookContainer.webhook_secret}
                  </div>
                </div>
              </div>

              {/* Step 4: Event */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                <span className="font-medium text-slate-700">4. Event:</span>
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

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestWebhookPing}
                disabled={pingingWebhook}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-semibold border border-purple-200 transition-colors cursor-pointer"
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
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className={`p-3 rounded-2xl shrink-0 ${
                confirmModal.variant === 'danger' 
                  ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                  : confirmModal.variant === 'warning'
                  ? 'bg-amber-50 text-amber-600 border border-amber-100'
                  : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
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
                <h3 className="text-base font-bold text-slate-800">{confirmModal.title}</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
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
                className={`px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5 ${
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
    </>
  );
};

export default DashboardHome;
