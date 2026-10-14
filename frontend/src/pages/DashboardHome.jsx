import { useState, useEffect, useCallback } from 'react';
import { Server, Play, Square, Trash2, ExternalLink, Activity, Box, Terminal, FileText, X, Cpu, HardDrive, RefreshCw, AlertTriangle, Settings, AlertCircle, CheckCircle2, Layers, Globe, Database } from 'lucide-react';

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

  const fetchContainers = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8080/api/containers');
      const data = await response.json();
      if (response.ok) {
        const containerList = data || [];
        setContainers(containerList);
        
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

  useEffect(() => {
    // หุ้มด้วยฟังก์ชัน async เพื่อเลี่ยง Linter ที่แจ้งเตือนเรื่องการเรียก State ทันทีใน Effect
    const initFetch = async () => {
      await fetchContainers();
    };
    initFetch();
    
    // ตั้งเวลาให้รีเฟรชอัตโนมัติทุกๆ 5 วินาที
    const interval = setInterval(() => {
      fetchContainers();
    }, 5000);
    
    return () => clearInterval(interval); // เคลียร์ timer ตอนปิดหน้าเว็บ
  }, [fetchContainers]);

  const handleAction = async (id, action) => {
    try {
      setLoading(true); // ปรับสถานะเป็นโหลดตอนกำลังกด Stop/Start เพื่อไม่ให้ผู้ใช้กดรัวๆ
      await fetch(`http://localhost:8080/api/containers/${id}/${action}`, { method: 'POST' });
      await fetchContainers(); // ดึงข้อมูลใหม่หลังทำเสร็จ
    } catch (error) {
      console.error("ดำเนินการล้มเหลว:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("คุณแน่ใจหรือไม่ที่จะลบเซิร์ฟเวอร์นี้? ข้อมูลทั้งหมดจะหายไป")) return;
    try {
      await fetch(`http://localhost:8080/api/containers/${id}`, { method: 'DELETE' });
      fetchContainers();
    } catch (error) {
      console.log("ลบข้อมูลล้มเหลว", error);
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
  // ฟังก์ชันสั่ง Re-deploy
  const handleRedeploy = async (id) => {
    if (!confirm("คุณต้องการดึงโค้ดใหม่และ Re-deploy เซิร์ฟเวอร์นี้ใช่ไหม? (ระบบจะรันตัวใหม่ซ้อนขึ้นมาให้ก่อน)")) return;
    
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
          // (หมายเหตุ: เมื่อเซิร์ฟเวอร์ใหม่สร้างเสร็จ ID จะเปลี่ยนไป ทำให้ตัวเดิมที่หมุนๆ อยู่หายไปเองโดยอัตโนมัติ!)
        }, 3000);

        // ตั้งเวลาไว้ว่าถ้าเกิน 2 นาที (120000ms) ให้เลิกเช็ค (กันระบบค้างถ้า Build พัง)
        setTimeout(() => {
          clearInterval(checkInterval);
          fetchContainers(); // รีเฟรชรอบสุดท้ายเผื่อกลับไปเป็น running
        }, 120000);

      } else {
        const errData = await response.json();
        alert("Error: " + errData.error);
        fetchContainers(); // ถ้าพัง ก็ให้รีเฟรชกลับเป็นสถานะเดิม
      }
    } catch (error) {
      alert("Error: " + error.message);
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

  return (
    <>
      <div className="bg-white/70 backdrop-blur-2xl p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 relative overflow-hidden">
      {/* Decorative Blob */}
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent flex items-center gap-2">
            <Server className="w-6 h-6 text-blue-500" />
            Active Servers
          </h3>
          <p className="text-slate-500 text-sm mt-1">Manage your deployed applications and microservices.</p>
        </div>
        <span className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-1.5 rounded-full shadow-sm flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" />
          Total Running: {containers.length}
        </span>
      </div>

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
                              className="text-xs font-semibold text-slate-900 truncate max-w-[180px] sm:max-w-[240px] md:max-w-[300px]" 
                              title={item.name}
                            >
                              {item.clean_name || item.name?.replace(/\s*\((Backend|Frontend)\)$/, '')}
                            </span>
                          </div>

                          <span className="text-[10px] text-slate-400 font-mono truncate">
                            {item.service_type === 'backend' || item.name?.includes('(Backend)') 
                              ? '⚙️ API Server (ตั้งค่า DB_URL ที่นี่)' 
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-blue-50 text-blue-700 border-blue-200">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                            Updating
                          </span>
                        ) : item.state === 'failed' || item.last_error ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-rose-100 text-rose-800 border-rose-300">
                              <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                              Failed
                            </span>
                            {item.last_error && (
                              <button
                                onClick={() => {
                                  setActiveErrorDetails(item.last_error);
                                  setActiveErrorContainerName(item.name);
                                  setErrorModalOpen(true);
                                }}
                                className="text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 px-1.5 py-0.5 rounded font-medium transition-colors inline-flex items-center gap-1"
                              >
                                <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                                ดู Error
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border
                            ${item.state === 'running' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {item.state === 'running' ? (
                              <span className="relative flex h-1.5 w-1.5 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                              </span>
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0"></span>
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
                              onClick={() => handleAction(item.id, 'stop')} 
                              className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Stop Server"
                            >
                              <Square className="w-3.5 h-3.5 fill-current" />
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleAction(item.id, 'start')} 
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
                            onClick={() => handleDelete(item.id)} 
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
    </>
  );
};

export default DashboardHome;
