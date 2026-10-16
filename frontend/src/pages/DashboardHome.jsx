import { useState, useEffect, useCallback, useRef } from 'react';
import { Server, Play, Square, Trash2, ExternalLink, Activity, Box, Terminal, FileText, X, Cpu, HardDrive, RefreshCw, AlertTriangle, Settings, AlertCircle, CheckCircle2, Layers, Globe, Database, Bell, BellRing, Sparkles, Copy, Check, Plus, Link2, Table, Code, Search, Download, Upload, GitBranch, Zap } from 'lucide-react';
import { toast } from 'sonner';

// แปลง URL เช่น https://github.com/thanawat-c/mock-api-server.git ให้เหลือชื่อสั้นๆ เช่น mock-api-server
const getShortAppName = (rawName, cleanName) => {
  const nameToParse = cleanName || rawName?.replace(/\s*\((Backend|Frontend)\)$/, '') || '';
  if (!nameToParse) return 'Unknown App';
  
  // ตัด .git ออก
  let cleaned = nameToParse.replace(/\.git\/?$/, '');
  
  // ตัด URL protocol และ domain ออก เช่น https://github.com/user/
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length > 0) {
      cleaned = parts[parts.length - 1]; // เอาส่วนท้ายสุดที่เป็นชื่อ repo
    }
  }
  return cleaned;
};

const DashboardHome = () => {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [currentLogs, setCurrentLogs] = useState('');
  const [logLoading, setLogLoading] = useState(false);
  const [activeContainerName, setActiveContainerName] = useState('');

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

  // Notification State
  const prevStatesRef = useRef({});
  const prevDbStatesRef = useRef({});
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('เบราว์เซอร์นี้ไม่รองรับ Desktop Notification');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setNotificationsEnabled(true);
        toast.success('เปิด Desktop Alert สำเร็จ!', {
          description: 'ระบบจะส่งการแจ้งเตือนทันทีเมื่อตรวจพบ Server ขัดข้องหรือดับลง',
        });
        new Notification('🔔 เปิดการแจ้งเตือนสำเร็จ', {
          body: 'ระบบจะส่งการแจ้งเตือนทันทีเมื่อตรวจพบ Server ขัดข้องหรือดับลง (Crashed)',
        });
      } else {
        setNotificationsEnabled(false);
        toast.warning('กรุณาอนุญาต Notification', {
          description: 'โปรดเปิดสิทธิ์ Notification ในการตั้งค่าเบราว์เซอร์เพื่อรับการแจ้งเตือน',
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
        
        // ตรวจจับ Container ที่เพิ่งดับ เพื่อส่ง Desktop Alert
        const prevStates = prevStatesRef.current;
        const prevDbStates = prevDbStatesRef.current;
        containerList.forEach(c => {
          const key = c.id || String(c.deployment_id);
          const prevState = prevStates[key];
          const currentState = c.state;

          if (prevState === 'running' && (currentState === 'exited' || currentState === 'failed')) {
            const shortName = getShortAppName(c.name, c.clean_name);

            // 1. แจ้งเตือนแบบ Toast บนหน้าจอเว็บทันที (ไม่พลาดแน่นอน)
            toast.error(`🚨 เซิร์ฟเวอร์ดับ! (${shortName})`, {
              description: `Service หยุดทำงานกะทันหัน (${currentState}) กรุณาตรวจสอบ Log`,
              duration: 8000,
            });

            // 2. แจ้งเตือนแบบ Desktop Notification บน macOS/Windows
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`🚨 เซิร์ฟเวอร์ดับ! (${shortName})`, {
                  body: `Service: ${c.name} หยุดทำงานกะทันหัน (${currentState})\nกรุณาเข้าสู่ Dashboard เพื่อดูสาเหตุ Error`,
                });
              } catch (notifErr) {
                console.error('Desktop Notification error:', notifErr);
              }
            }
          }

          // ตรวจจับ Database ที่หยุดทำงาน สำหรับ Service ที่กำลังรันอยู่
          const wasDbStopped = prevDbStates[key];
          const isDbStopped = !!c.is_db_stopped;
          if (currentState === 'running' && isDbStopped && !wasDbStopped) {
            const shortName = getShortAppName(c.name, c.clean_name);
            const dbName = c.linked_db_name || 'Database';

            toast.warning(`⚠️ ฐานข้อมูลหลุดการเชื่อมต่อ (${shortName})`, {
              description: `Database "${dbName}" หยุดทำงานอยู่ ทำให้ Service ไม่สามารถเข้าถึงข้อมูลได้ (Error 500)`,
              duration: 8000,
            });

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`⚠️ ฐานข้อมูลหลุดการเชื่อมต่อ! (${shortName})`, {
                  body: `Database: ${dbName} หยุดทำงานอยู่ อาจทำให้ API ตอบกลับเป็น Error 500`,
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
      console.error("โหลดข้อมูลล้มเหลว:", error);
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
      toast.warning('กรุณาระบุชื่อ Database');
      return;
    }
    setCreatingDb(true);
    const toastId = toast.loading('กำลังสร้าง Database และผูก Persistent Volume...');
    try {
      const res = await fetch('http://localhost:8080/api/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDbName.trim(), type: 'postgres' }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('สร้างฐานข้อมูลสำเร็จ!', {
          id: toastId,
          description: `PostgreSQL พร้อมใช้งานที่พอร์ตภายนอก ${data.database.host_port}`,
        });
        setNewDbName('');
        setCreateDbModalOpen(false);
        fetchDatabases();
      } else {
        toast.error('สร้าง Database ล้มเหลว', {
          id: toastId,
          description: data.error || 'Unknown error',
        });
      }
    } catch (err) {
      toast.error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', {
        id: toastId,
        description: err.message,
      });
    } finally {
      setCreatingDb(false);
    }
  };

  const handleToggleDb = async (id, currentStatus) => {
    const action = currentStatus === 'running' ? 'stop' : 'start';
    const toastId = toast.loading(action === 'stop' ? 'กำลังหยุด Database...' : 'กำลังเริ่ม Database...');
    try {
      const res = await fetch(`http://localhost:8080/api/databases/${id}/${action}`, { method: 'POST' });
      if (res.ok) {
        toast.success(action === 'stop' ? 'หยุด Database สำเร็จ' : 'เริ่ม Database สำเร็จ', { id: toastId });
        fetchDatabases();
        fetchContainers();
      } else {
        const data = await res.json();
        toast.error('ดำเนินการล้มเหลว', { id: toastId, description: data.error });
      }
    } catch (err) {
      toast.error('เชื่อมต่อล้มเหลว', { id: toastId, description: err.message });
    }
  };

  const handleDeleteDb = async (id, name) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ที่จะลบ Database "${name}"? ข้อมูลใน Volume จะถูกลบทิ้งอย่างถาวร`)) {
      return;
    }
    const toastId = toast.loading('กำลังลบ Database และเคลียร์ Volume...');
    try {
      const res = await fetch(`http://localhost:8080/api/databases/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('ลบ Database สำเร็จ', { id: toastId });
        fetchDatabases();
      } else {
        const data = await res.json();
        toast.error('ลบล้มเหลว', { id: toastId, description: data.error });
      }
    } catch (err) {
      toast.error('เชื่อมต่อล้มเหลว', { id: toastId, description: err.message });
    }
  };

  const handleCopyUrl = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('คัดลอก Connection URL แล้ว!', { description: 'พร้อมนำไปแปะใน .env หรือโปรแกรมฐานข้อมูล' });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenSqlStudio = async (db) => {
    setActiveSqlDb(db);
    setSqlModalOpen(true);
    setSqlResult('');
    setSqlQuery("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';");
    setSqlTables([]);
    try {
      const res = await fetch(`http://localhost:8080/api/databases/${db.id}/tables`);
      if (res.ok) {
        const data = await res.json();
        setSqlTables(data.tables || []);
      }
    } catch (err) {
      console.error('Failed to load tables:', err);
    }
  };

  const handleExecuteQuery = async (queryToRun) => {
    const q = queryToRun || sqlQuery;
    if (!q.trim() || !activeSqlDb) return;
    setRunningSql(true);
    try {
      const res = await fetch(`http://localhost:8080/api/databases/${activeSqlDb.id}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSqlResult(data.result || 'คำสั่งสำเร็จ (ไม่มีข้อความตอบกลับ)');
        // รีโหลดรายชื่อ Table เผื่อมีการสร้าง/ลบ Table
        const tblRes = await fetch(`http://localhost:8080/api/databases/${activeSqlDb.id}/tables`);
        if (tblRes.ok) {
          const tblData = await tblRes.json();
          setSqlTables(tblData.tables || []);
        }
      } else {
        setSqlResult(`❌ ข้อผิดพลาด:\n${data.error || 'Query failed'}`);
      }
    } catch (err) {
      setSqlResult(`❌ การเชื่อมต่อล้มเหลว: ${err.message}`);
    } finally {
      setRunningSql(false);
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
      toast.warning('กรุณาเลือกเซิร์ฟเวอร์ที่ต้องการผูก');
      return;
    }
    setBindingServer(true);
    const toastId = toast.loading(`กำลังผูก Database เข้ากับเซิร์ฟเวอร์ และเริ่มรีสตาร์ต...`);
    try {
      const res = await fetch(`http://localhost:8080/api/databases/${activeBindDb.id}/bind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container_id: selectedTargetContainer }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('ผูก Database สำเร็จ!', {
          id: toastId,
          description: `ส่งตัวแปร (DATABASE_URL, DB_URL ฯลฯ) และรีสตาร์ตเซิร์ฟเวอร์แล้ว`,
        });
        setBindModalOpen(false);
        fetchContainers();
      } else {
        toast.error('ผูก Database ล้มเหลว', { id: toastId, description: data.error });
      }
    } catch (err) {
      toast.error('เชื่อมต่อล้มเหลว', { id: toastId, description: err.message });
    } finally {
      setBindingServer(false);
    }
  };

  const handleBackupDb = async (db) => {
    setBackingUpId(db.id);
    const toastId = toast.loading(`กำลังสร้างไฟล์ Backup (.sql) สำหรับ "${db.name}"...`);
    try {
      const response = await fetch(`http://localhost:8080/api/databases/${db.id}/backup`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'ไม่สามารถดาวน์โหลด Backup ได้');
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

      toast.success('ดาวน์โหลด Backup สำเร็จ!', {
        id: toastId,
        description: `สร้างไฟล์ backup-${db.name}.sql เรียบร้อยแล้ว`,
      });
    } catch (err) {
      toast.error('Backup ล้มเหลว', { id: toastId, description: err.message });
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
      toast.warning('กรุณาเลือกไฟล์ .sql เพื่อกู้คืนข้อมูล');
      return;
    }

    setRestoring(true);
    setRestoreResult('');
    const toastId = toast.loading(`กำลังกู้คืนข้อมูลเข้า "${activeRestoreDb.name}"...`);

    const formData = new FormData();
    formData.append('file', restoreFile);

    try {
      const res = await fetch(`http://localhost:8080/api/databases/${activeRestoreDb.id}/restore`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('กู้คืนข้อมูลสำเร็จเรียบร้อย!', { id: toastId });
        setRestoreResult(data.output || 'Restore Completed Successfully.');
      } else {
        toast.error('การกู้คืนข้อมูลล้มเหลว', { id: toastId, description: data.error });
        setRestoreResult(`Error: ${data.error}\n${data.output || ''}`);
      }
    } catch (err) {
      toast.error('เชื่อมต่อล้มเหลว', { id: toastId, description: err.message });
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
    const toastId = toast.loading('กำลังส่ง Ping Test ไปยัง Webhook...');
    try {
      const res = await fetch(`http://localhost:8080/api/webhooks/deploy/${activeWebhookContainer.deployment_id}`, {
        method: 'POST',
        headers: {
          'X-GitHub-Event': 'ping',
        },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Webhook ตอบกลับสำเร็จ (Pong!)', {
          id: toastId,
          description: data.message || 'ระบบพร้อมรับ Push Event จาก GitHub แล้ว',
        });
      } else {
        toast.error('ทดสอบล้มเหลว', { id: toastId, description: data.error });
      }
    } catch (err) {
      toast.error('เชื่อมต่อล้มเหลว', { id: toastId, description: err.message });
    } finally {
      setPingingWebhook(false);
    }
  };

  const handleAction = async (id, action, containerName) => {
    try {
      setLoading(true); // ปรับสถานะเป็นโหลดตอนกำลังกด Stop/Start เพื่อไม่ให้ผู้ใช้กดรัวๆ
      const res = await fetch(`http://localhost:8080/api/containers/${id}/${action}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // หาก Start ไม่สำเร็จ หรือแอปพลิเคชัน Crash ดับลงทันที ให้เด้ง Modal สาเหตุให้ดูทันที!
        const errorTitle = data.error || `คำสั่ง ${action} ไม่สำเร็จ`;
        const errorDetails = data.details || errorTitle;
        setActiveErrorContainerName(containerName || id);
        setActiveErrorDetails(errorDetails);
        setErrorModalOpen(true);
      }
      await fetchContainers(); // ดึงข้อมูลใหม่หลังทำเสร็จ
    } catch (error) {
      console.error("ดำเนินการล้มเหลว:", error);
      setActiveErrorContainerName(containerName || id);
      setActiveErrorDetails(error.message);
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (identifier) => {
    if (!identifier) {
      toast.error("ไม่พบรหัสของเซิร์ฟเวอร์นี้");
      return;
    }
    if (!window.confirm("คุณแน่ใจหรือไม่ที่จะลบเซิร์ฟเวอร์นี้? ข้อมูลและประวัตินี้จะถูกลบออก")) return;
    
    // อัปเดตหน้าจอทันที (Optimistic UI) ลบแถวนี้ออกจากตารางทันทีไม่ต้องรอ
    setContainers(prev => prev.filter(c => c.id !== identifier && c.deployment_id !== identifier));
    const toastId = toast.loading("กำลังลบเซิร์ฟเวอร์...");

    try {
      const res = await fetch(`http://localhost:8080/api/containers/${identifier}`, { method: 'DELETE' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        toast.error("เกิดข้อผิดพลาดในการลบ", { id: toastId, description: errJson.error || "ไม่สามารถลบได้" });
      } else {
        toast.success("ลบเซิร์ฟเวอร์เรียบร้อย", { id: toastId });
      }
      await fetchContainers();
    } catch (error) {
      console.log("ลบข้อมูลล้มเหลว", error);
      toast.error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ", { id: toastId, description: error.message });
      await fetchContainers();
    }
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

  // ฟังก์ชันสั่ง Re-deploy
  const handleRedeploy = async (id) => {
    if (!confirm("คุณต้องการดึงโค้ดใหม่และ Re-deploy เซิร์ฟเวอร์นี้ใช่ไหม? (ระบบจะรันตัวใหม่ซ้อนขึ้นมาให้ก่อน)")) return;
    
    toast.info("เริ่มกระบวนการ Re-deploy...", {
      description: "กำลังดึงโค้ดล่าสุดจาก Git และสร้าง Container ใหม่",
    });

    // 1. 🪄 หลอกตาผู้ใช้! สั่งเปลี่ยนสถานะของตัวนี้ให้เป็น 'redeploying' ทันที
    setContainers(prev => prev.map(c => 
      c.id === id ? { ...c, state: 'redeploying' } : c
    ));

    try {
      const response = await fetch(`http://localhost:8080/api/containers/${id}/redeploy`, {
        method: 'POST',
      });
      
      if (response.ok) {
        // 2. 🕵️‍♂️ สั่งให้เบราว์เซอร์แอบยิงไปเช็คข้อมูลใหม่ทุกๆ 3 วินาที (Polling)
        const checkInterval = setInterval(() => {
          fetchContainers(); 
        }, 3000);

        setTimeout(() => {
          clearInterval(checkInterval);
          fetchContainers();
        }, 120000);

      } else {
        const errData = await response.json();
        toast.error("Re-deploy ล้มเหลว", { description: errData.error });
        fetchContainers();
      }
    } catch (error) {
      toast.error("การเชื่อมต่อล้มเหลว", { description: error.message });
    } finally {
      fetchContainers();
    }
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
        // กรองค่าตัวแปรมาตรฐานออก แสดงเฉพาะตัวแปรทั่วไปหรือแสดงทั้งหมด
        setCurrentEnvText(data.env.join('\n'));
      }
    } catch (err) {
      setEnvError('ไม่สามารถโหลด Env ได้: ' + err.message);
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
        setEnvSuccess('บันทึกและรีสตาร์ตเซิร์ฟเวอร์เรียบร้อย!');
        fetchContainers();
        setTimeout(() => {
          setEnvModalOpen(false);
        }, 1500);
      } else {
        setEnvError(data.error || 'บันทึกล้มเหลว');
      }
    } catch (err) {
      setEnvError('เกิดข้อผิดพลาด: ' + err.message);
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
            title={notificationsEnabled ? 'เปิดการแจ้งเตือน Desktop Alert อยู่' : 'คลิกเพื่อเปิดแจ้งเตือนบนหน้าจอเมื่อมี Server ดับ'}
          >
            {notificationsEnabled ? (
              <BellRing className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Bell className="w-3.5 h-3.5 text-slate-400" />
            )}
            {notificationsEnabled ? 'Desktop Alert: เปิด' : 'เปิดแจ้งเตือน Desktop'}
          </button>

          <span className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-1.5 rounded-full shadow-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            Running: {containers.filter(c => c.state === 'running').length} / {containers.length}
          </span>
        </div>
      </div>

      {/* Alert Banner สำหรับแจ้งเตือนทันทีเมื่อตรวจพบ Server ดับ (Crashed / Exited) */}
      {crashedContainers.length > 0 && !dismissAlert && (
        <div className="relative z-10 mb-6 p-4 rounded-2xl bg-rose-50/90 border border-rose-200 shadow-xs flex items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 rounded-xl text-rose-600 shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-semibold text-rose-950 text-sm flex items-center gap-2">
                ตรวจพบเซิร์ฟเวอร์ขัดข้อง ({crashedContainers.length} Service ดับลงกะทันหัน)
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                โปรดคลิกที่ปุ่ม <span className="font-semibold text-rose-800">[🔴 Crashed Logs]</span> ในตารางด้านล่างเพื่อดูสาเหตุ หรือกดปุ่มสตาร์ตเพื่อเริ่มทำงานใหม่
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissAlert(true)}
            className="text-slate-400 hover:text-slate-600 hover:bg-rose-100/60 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
            title="ปิดการแจ้งเตือนนี้"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Alert Banner สำหรับแจ้งเตือนเมื่อตรวจพบ Database ของ Service หลุดการเชื่อมต่อ / หยุดทำงาน */}
      {dbDisconnectedContainers.length > 0 && !dismissDbAlert && (
        <div className="relative z-10 mb-6 p-4 rounded-2xl bg-amber-50/95 border border-amber-300 shadow-xs flex items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0">
              <Database className="w-5 h-5 animate-pulse text-amber-600" />
            </div>
            <div>
              <h4 className="font-semibold text-amber-950 text-sm flex items-center gap-2">
                ⚠️ ตรวจพบฐานข้อมูลหยุดทำงาน ({dbDisconnectedContainers.length} Service เชื่อมต่อ DB ไม่ได้)
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Service <span className="font-bold">{dbDisconnectedContainers.map(c => getShortAppName(c.name, c.clean_name)).join(', ')}</span> กำลังทำงาน แต่ฐานข้อมูล <span className="font-bold">({dbDisconnectedContainers[0].linked_db_name || 'Database'})</span> หยุดทำงานอยู่ อาจส่งผลให้ระบบตอบกลับเป็น Error 500
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
                สตาร์ต Database ทันที
              </button>
            )}
            <button
              onClick={() => setDismissDbAlert(true)}
              className="text-slate-400 hover:text-slate-600 hover:bg-amber-100/60 p-1.5 rounded-lg transition-colors cursor-pointer"
              title="ปิดการแจ้งเตือนนี้"
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
                    <th scope="col" className="hidden md:table-cell px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Usage</th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">URL</th>
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

                          <span className="text-[10px] text-slate-400 font-mono truncate">
                            {item.service_type === 'backend' || item.name?.includes('(Backend)') 
                              ? '⚙️ API Server' 
                              : item.service_type === 'frontend' || item.name?.includes('(Frontend)')
                              ? '🌐 Web UI'
                              : '📦 Standalone'}
                          </span>
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
                            title="คลิกเพื่อดู Log สาเหตุที่ขัดข้อง"
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
                              title={item.db_warning || `เชื่อมต่อฐานข้อมูล ${item.linked_db_name || 'DB'} ไม่ได้เนื่องจากฐานข้อมูลหยุดทำงาน`}
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
                                title="คลิกเพื่อสตาร์ต Database ทันที"
                              >
                                <Play className="w-2.5 h-2.5 fill-current" /> สตาร์ต DB
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
                      <td className="px-3 py-3">
                        {item.state === 'running' && item.domain_name ? (
                          <a 
                            href={`http://${item.domain_name}`} 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md"
                          >
                            Visit <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Offline</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-0.5">
                          {item.state === 'running' ? (
                            <button 
                              onClick={() => handleAction(item.id, 'stop', item.name)} 
                              className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Stop Server"
                            >
                              <Square className="w-3.5 h-3.5 fill-current" />
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleAction(item.id, 'start', item.name)} 
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Start Server"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleViewLogs(item.id, item.name)} 
                            className="p-1 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                            title="View Logs"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleOpenEnv(item.id, item.name)} 
                            className="p-1 rounded text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Environment Variables (ตั้งค่าตัวแปร)"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {handleRedeploy(item.id)}}
                            className="p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Re-deploy (อัปเดตโค้ดใหม่)"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenWebhookModal(item)}
                            className="p-1 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition-colors"
                            title="GitHub Webhook (Auto-deploy on Push)"
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id || item.deployment_id)} 
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Server"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
                  ฐานข้อมูลพร้อมใช้ทันที • จำกัด RAM 512 MB ต่อก้อน • Persistent Volume ปลอดภัยข้อมูลไม่หาย
                </p>
              </div>
            </div>

            <button
              onClick={() => setCreateDbModalOpen(true)}
              disabled={databases.length >= 5}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>สร้าง Database ใหม่</span>
            </button>
          </div>

          {databases.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-3">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">ยังไม่มี Managed Database</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                สร้างฐานข้อมูล PostgreSQL 16 สำหรับใช้ร่วมกับแอปพลิเคชันของคุณได้ใน 1 คลิก พร้อมจำกัดทรัพยากรเพื่อไม่ให้กินสเปกเครื่อง
              </p>
              <button
                onClick={() => setCreateDbModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>สร้าง Database ก้อนแรก</span>
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
                          <button
                            onClick={() => handleToggleDb(db.id, db.status)}
                            title={isRunning ? "หยุด Database (Stop)" : "เริ่มทำงาน (Start)"}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isRunning 
                                ? 'text-amber-600 hover:bg-amber-50' 
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {isRunning ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                          </button>
                          <button
                            onClick={() => handleDeleteDb(db.id, db.name)}
                            title="ลบ Database (Delete)"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Specs Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-4 text-[10px] font-semibold text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100/60">
                          ⚡ 512 MB Cap
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100/60">
                          🔌 Port: {db.host_port}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          💾 Named Volume
                        </span>
                      </div>

                      {/* Live RAM Stats */}
                      {isRunning && stats[db.container_id] && (
                        <div className="mb-3.5 p-2.5 rounded-xl bg-white border border-slate-200/70 shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                              <Activity className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                              <span>RAM ใช้งานจริง:</span>
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
                          <span>ผูกกับ Server</span>
                        </button>
                      </div>

                      {/* Backup & Restore Tools */}
                      <div className="grid grid-cols-2 gap-2 mb-3.5">
                        <button
                          type="button"
                          onClick={() => handleBackupDb(db)}
                          disabled={!isRunning || backingUpId === db.id}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-200/60 transition-colors cursor-pointer"
                          title="ดาวน์โหลดไฟล์ .sql สำรองข้อมูล"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{backingUpId === db.id ? 'Exporting...' : 'Backup (.sql)'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenRestoreModal(db)}
                          disabled={!isRunning}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-800 rounded-lg text-xs font-semibold border border-amber-200/60 transition-colors cursor-pointer"
                          title="อัปโหลดไฟล์ .sql เพื่อกู้คืนข้อมูล"
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
                            <span className="font-medium text-indigo-700">Internal URL (สำหรับ App ในระบบ):</span>
                            <button
                              onClick={() => handleCopyUrl(db.internal_url, `internal-${db.id}`)}
                              className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-600 font-medium"
                            >
                              {copiedKey === `internal-${db.id}` ? (
                                <><Check className="w-3 h-3 text-emerald-600" /> คัดลอกแล้ว</>
                              ) : (
                                <><Copy className="w-3 h-3" /> คัดลอก</>
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
                                <><Check className="w-3 h-3 text-emerald-600" /> คัดลอกแล้ว</>
                              ) : (
                                <><Copy className="w-3 h-3" /> คัดลอก</>
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
                เพิ่มหรือแก้ไขตัวแปรระบบ (1 บรรทัดต่อ 1 ค่า เช่น <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">DB_URL=host=...</code>) ระบบจะรีสตาร์ตเซิร์ฟเวอร์ให้อัตโนมัติ:
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
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveEnv}
                disabled={envSaving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20"
              >
                {envSaving ? "กำลังบันทึกและรีสตาร์ต..." : "บันทึกและ Restart"}
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
              <p className="text-xs text-slate-600 font-medium">ข้อความแจ้งเตือนความผิดพลาดจากระบบ:</p>
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
                ปิดหน้าต่าง
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
                  <h3 className="text-base font-bold text-slate-800">สร้าง Managed Database ใหม่</h3>
                  <p className="text-xs text-slate-500">PostgreSQL 16 Alpine • พร้อมใช้ใน 1 คลิก</p>
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
                    ชื่อ Database Identifier <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newDbName}
                    onChange={(e) => setNewDbName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="เช่น prod-db, my-app-db"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    ใช้เฉพาะตัวอักษรภาษาอังกฤษพิมพ์เล็ก ตัวเลข ขีดกลาง (-) และขีดล่าง (_)
                  </p>
                </div>

                {/* Resource Summary Specs Card */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">ข้อกำหนดทรัพยากร (Resource Allocation):</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200/60">
                      <div className="text-[10px] text-slate-400 font-medium">RAM HARD CAP</div>
                      <div className="text-xs font-bold text-indigo-600 mt-0.5">512 MB Max</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200/60">
                      <div className="text-[10px] text-slate-400 font-medium">CPU LIMIT</div>
                      <div className="text-xs font-bold text-slate-700 mt-0.5">1.0 Core</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200/60">
                      <div className="text-[10px] text-slate-400 font-medium">PERSISTENT STORAGE</div>
                      <div className="text-xs font-bold text-emerald-600 mt-0.5">Docker Volume</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200/60">
                      <div className="text-[10px] text-slate-400 font-medium">DOCKER NETWORK</div>
                      <div className="text-xs font-bold text-slate-700 mt-0.5">ai-cloud-network</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 pt-1 leading-relaxed">
                    💡 ระบบจะสร้าง Volume ถาวรแยกเฉพาะก้อน และผูกพอร์ตภายนอกอัตโนมัติ (เริ่มที่ 5433)
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateDbModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={creatingDb || !newDbName.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  {creatingDb ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>กำลังสร้าง Instance...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>สร้าง Database ทันที</span>
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    SQL Studio: <span className="text-indigo-600 font-mono">{activeSqlDb.name}</span>
                  </h3>
                  <p className="text-xs text-slate-500">PostgreSQL 16 • ตรวจสอบ Table และรันคำสั่ง SQL ได้ทันทีบนเว็บ</p>
                </div>
              </div>
              <button 
                onClick={() => setSqlModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Tables Bar */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2">
                  <Table className="w-4 h-4 text-indigo-600" />
                  <span>Tables ในฐานข้อมูล ({sqlTables.length} ตาราง):</span>
                </div>
                {sqlTables.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    ยังไม่มี Table ในฐานข้อมูล (คุณสามารถพิมพ์คำสั่ง CREATE TABLE ด้านล่างเพื่อสร้างได้เลย)
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {sqlTables.map((tbl) => (
                      <button
                        key={tbl}
                        type="button"
                        onClick={() => {
                          const query = `SELECT * FROM ${tbl} LIMIT 50;`;
                          setSqlQuery(query);
                          handleExecuteQuery(query);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 font-mono text-xs font-medium shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                        title="คลิกเพื่อดูข้อมูลในตารางนี้"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>{tbl}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* SQL Query Editor */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    คำสั่ง SQL (Query Editor):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSqlQuery("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")}
                      className="text-[11px] text-slate-500 hover:text-indigo-600 font-medium px-2 py-0.5 rounded hover:bg-slate-100 transition-colors"
                    >
                      ดูรายชื่อตาราง
                    </button>
                    {sqlTables.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSqlQuery(`SELECT * FROM ${sqlTables[0]} LIMIT 20;`)}
                        className="text-[11px] text-slate-500 hover:text-indigo-600 font-medium px-2 py-0.5 rounded hover:bg-slate-100 transition-colors"
                      >
                        ดูข้อมูล {sqlTables[0]}
                      </button>
                    )}
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
                  rows="4"
                  placeholder="SELECT * FROM users LIMIT 10;"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
                ></textarea>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>💡 กด <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono">Cmd + Enter</kbd> หรือ <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono">Ctrl + Enter</kbd> เพื่อรันคำสั่งได้ทันที</span>
                  <button
                    type="button"
                    onClick={() => handleExecuteQuery()}
                    disabled={runningSql || !sqlQuery.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    {runningSql ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>กำลังรัน...</span>
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
                  ผลลัพธ์คำสั่ง (Query Output):
                </label>
                <div className="p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs leading-relaxed max-h-56 overflow-auto whitespace-pre border border-slate-800 shadow-inner">
                  {sqlResult || "-- กดปุ่ม Run Query เพื่อดูผลลัพธ์ --"}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                หรือต่อผ่าน External URL: <code className="font-mono text-slate-600">{activeSqlDb.external_url}</code>
              </span>
              <button
                type="button"
                onClick={() => setSqlModalOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bind Database to Server Modal */}
      {bindModalOpen && activeBindDb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">ผูก Database กับเซิร์ฟเวอร์</h3>
                  <p className="text-xs text-slate-500">Auto-Inject Environment Variables และรีสตาร์ตทันที</p>
                </div>
              </div>
              <button 
                onClick={() => setBindModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
                <p className="font-bold mb-1">🔗 ระบบจะดำเนินการดังนี้ให้อัตโนมัติ:</p>
                <ul className="list-disc list-inside space-y-0.5 text-indigo-800">
                  <li>แทรกตัวแปร <code className="font-mono font-bold">DATABASE_URL</code>, <code className="font-mono font-bold">DB_URL</code>, <code className="font-mono font-bold">DB_HOST</code> เข้าเซิร์ฟเวอร์</li>
                  <li>สั่งรีสตาร์ตเซิร์ฟเวอร์เพื่อให้เริ่มต่อเข้ากับ Database <span className="font-bold">"{activeBindDb.name}"</span> ทันที</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  เลือกเซิร์ฟเวอร์ที่ต้องการผูก:
                </label>
                {containers.filter(c => c.state === 'running').length === 0 ? (
                  <p className="text-xs text-rose-500 p-3 rounded-lg bg-rose-50 border border-rose-200">
                    ไม่พบเซิร์ฟเวอร์ที่กำลังออนไลน์อยู่ กรุณากด Start เซิร์ฟเวอร์ก่อน
                  </p>
                ) : (
                  <select
                    value={selectedTargetContainer}
                    onChange={(e) => setSelectedTargetContainer(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {containers.filter(c => c.state === 'running').map((c) => (
                      <option key={c.id} value={c.id}>
                        🚀 {getShortAppName(c.name, c.clean_name)} ({c.id.slice(0, 8)}) - {c.domain_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setBindModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmBind}
                disabled={bindingServer || !selectedTargetContainer}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                {bindingServer ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>กำลังผูกและรีสตาร์ต...</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4" />
                    <span>ผูกทันทีและ Restart</span>
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
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">กู้คืนข้อมูล (Restore Database)</h3>
                  <p className="text-xs text-slate-500">เป้าหมาย: {activeRestoreDb.name} ({activeRestoreDb.type})</p>
                </div>
              </div>
              <button 
                onClick={() => setRestoreModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                <p className="font-bold mb-1">⚠️ คำเตือนการกู้คืนข้อมูล:</p>
                <p className="text-amber-800">
                  ไฟล์ SQL จะถูกนำไปรันในฐานข้อมูลโดยตรง หากไฟล์มีคำสั่ง <code className="font-mono font-bold">DROP TABLE</code> ข้อมูลเดิมจะถูกลบและแทนที่ด้วยข้อมูลจากไฟล์ Backup
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  เลือกไฟล์สำรองข้อมูล (.sql):
                </label>
                <input
                  type="file"
                  accept=".sql,.dump"
                  onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 border border-slate-200 rounded-xl p-1 bg-slate-50 cursor-pointer"
                />
                {restoreFile && (
                  <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                    ✓ เลือกไฟล์: {restoreFile.name} ({(restoreFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {restoreResult && (
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600">ผลการทำงาน (Output):</span>
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] max-h-36 overflow-y-auto whitespace-pre-wrap">
                    {restoreResult}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={restoring || !restoreFile}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer"
              >
                {restoring ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>กำลังกู้คืนข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>เริ่มกู้คืน (Restore Now)</span>
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
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">GitHub Auto-Deploy Webhook</h3>
                  <p className="text-xs text-slate-500">
                    Service: {getShortAppName(activeWebhookContainer.name, activeWebhookContainer.clean_name)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setWebhookModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-100 text-xs text-purple-900 leading-relaxed">
                <p className="font-bold mb-1">⚡ เมื่อคุณ Git Push โค้ดใหม่เข้า GitHub:</p>
                <p className="text-purple-800">
                  GitHub จะส่งสัญญาณมาที่ URL ด้านล่าง เพื่อสั่งให้ AI-Cloud Platform ดึงโค้ดล่าสุด บิลด์ Image ใหม่ และสลับรันให้อัตโนมัติในทันที (Zero-effort CI/CD)
                </p>
              </div>

              {/* Step 1: Payload URL & Localhost Tunnel Helper */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span>1. Payload URL:</span>
                  <button
                    onClick={() => {
                      const urlToCopy = activeWebhookContainer 
                        ? (customPublicUrl.trim() 
                            ? `${customPublicUrl.trim().replace(/\/$/, '')}/api/webhooks/deploy/${activeWebhookContainer.deployment_id}`
                            : activeWebhookContainer.webhook_url)
                        : '';
                      handleCopyUrl(urlToCopy, `wh-url-${activeWebhookContainer.deployment_id}`);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-700 font-medium"
                  >
                    {copiedKey === `wh-url-${activeWebhookContainer.deployment_id}` ? (
                      <><Check className="w-3.5 h-3.5 text-emerald-600" /> คัดลอกแล้ว</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /> คัดลอก URL</>
                    )}
                  </button>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 text-purple-300 font-mono text-xs select-all border border-slate-800 break-all">
                  {activeWebhookContainer && (customPublicUrl.trim() 
                    ? `${customPublicUrl.trim().replace(/\/$/, '')}/api/webhooks/deploy/${activeWebhookContainer.deployment_id}`
                    : activeWebhookContainer.webhook_url)}
                </div>

                {/* Localhost Warning & Public Tunnel Helper */}
                <div className="mt-2.5 p-3 rounded-xl bg-amber-50/90 border border-amber-200/80 text-xs text-amber-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-950">ทำไมใส่ localhost ใน GitHub ไม่ได้?</p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        GitHub เป็นเซิร์ฟเวอร์บนอินเทอร์เน็ต จะไม่สามารถเข้าถึง <code className="font-mono bg-amber-100 px-1 rounded">localhost</code> ของคอมพิวเตอร์คุณได้โดยตรง ต้องเปิดท่อ Tunnel ชั่วคราวด้วยคำสั่งด้านล่าง:
                      </p>
                    </div>
                  </div>

                  {/* One-click command copy */}
                  <div className="space-y-1.5 pt-1 border-t border-amber-200/60">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-700">รันคำสั่งนี้ใน Terminal (ไม่ต้องติดตั้งอะไรเพิ่ม):</span>
                      <button
                        onClick={() => handleCopyUrl('npx localtunnel --port 8080', 'cmd-localtunnel')}
                        className="text-amber-800 hover:text-amber-950 font-semibold inline-flex items-center gap-1"
                      >
                        {copiedKey === 'cmd-localtunnel' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        คัดลอกคำสั่ง
                      </button>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-amber-200 font-mono text-[11px] text-slate-800 flex items-center justify-between">
                      <code>npx localtunnel --port 8080</code>
                    </div>
                  </div>

                  {/* Public Domain input */}
                  <div className="pt-1">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      วาง Public URL ที่ได้จาก Terminal (เช่น https://xxxx.loca.lt หรือ https://xxxx.trycloudflare.com):
                    </label>
                    <input
                      type="text"
                      value={customPublicUrl}
                      onChange={(e) => handleUpdatePublicUrl(e.target.value)}
                      placeholder="https://xxxx.loca.lt"
                      className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Content type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-1.5">2. Content type:</span>
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800 font-mono text-xs font-bold border border-slate-200">
                    application/json
                  </div>
                </div>

                {/* Step 3: Secret */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                    <span>3. Secret (แนะนำ):</span>
                    <button
                      onClick={() => handleCopyUrl(activeWebhookContainer.webhook_secret, `wh-sec-${activeWebhookContainer.deployment_id}`)}
                      className="inline-flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-700 font-medium"
                    >
                      {copiedKey === `wh-sec-${activeWebhookContainer.deployment_id}` ? (
                        <><Check className="w-3.5 h-3.5 text-emerald-600" /> คัดลอกแล้ว</>
                      ) : (
                        <><Copy className="w-3.5 h-3.5" /> คัดลอก</>
                      )}
                    </button>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800 font-mono text-xs truncate border border-slate-200">
                    {activeWebhookContainer.webhook_secret}
                  </div>
                </div>
              </div>

              {/* Step 4: Event Trigger */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <span className="font-semibold text-slate-800">4. Which events would you like to trigger this webhook?</span>
                <p>เลือก: <span className="font-bold text-indigo-700">Just the push event</span> (สั่ง Deploy เมื่อมีคน Push โค้ด)</p>
              </div>

              {/* GitHub Link Guide */}
              {activeWebhookContainer.clean_name?.startsWith('http') && (
                <div className="text-right">
                  <a
                    href={`${activeWebhookContainer.clean_name.replace(/\.git$/, '')}/settings/hooks`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 font-medium underline"
                  >
                    <span>เปิดหน้า GitHub Webhooks ของ Repo นี้</span>
                    <ExternalLink className="w-3.5 h-3.5" />
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
                    <span>กำลังทดสอบ...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>ทดสอบยิง Ping (Test Ping)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setWebhookModalOpen(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                เสร็จสิ้น
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardHome;
