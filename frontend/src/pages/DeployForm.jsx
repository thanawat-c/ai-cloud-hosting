import { useState, useEffect } from 'react';
import { Rocket, GitBranch, Terminal, CheckCircle2, XCircle, ExternalLink, Sparkles, Key, Eye, EyeOff, Lock, ChevronDown, SlidersHorizontal, FileText, Database, Wand2, Check } from 'lucide-react';
import { toast } from 'sonner';

const DeployForm = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [gitToken, setGitToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [containerId, setContainerId] = useState('');
  const [aiDockerfile, setAiDockerfile] = useState(''); 
  const [publicPort, setPublicPort] = useState('');
  const [deployLogs, setDeployLogs] = useState('');
  const [envVars, setEnvVars] = useState("");
  const [forceAi, setForceAi] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [databases, setDatabases] = useState([]);
  const [selectedDbId, setSelectedDbId] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState(null);

  useEffect(() => {
    fetch('http://localhost:8080/api/databases')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDatabases(data);
      })
      .catch(err => console.error('Failed to load databases in deploy form:', err));
  }, []);

  const handleInspectRepo = async (targetUrl) => {
    const url = (targetUrl || repoUrl).trim();
    if (!url) {
      toast.warning('กรุณาระบุ GitHub Repository ก่อนทำการสแกน');
      return;
    }
    setInspecting(true);
    setInspectResult(null);
    const toastId = toast.loading('AI กำลังสแกนโค้ดและตรวจหา Environment Variables...');
    try {
      const res = await fetch('http://localhost:8080/api/inspect-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: url, git_token: gitToken.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setInspectResult(data);
        toast.success('วิเคราะห์โปรเจกต์สำเร็จ!', {
          id: toastId,
          description: `ตรวจพบ Framework: ${data.detected_framework} พร้อม ${data.detected_envs?.length || 0} ตัวแปรที่แอปต้องการ`,
        });
        // เปิดเมนู Advanced Configuration ให้อัตโนมัติ
        setShowAdvanced(true);
        // ถ้าช่อง env ยังว่าง ให้ใส่ Template ให้อัตโนมัติ
        if (!envVars.trim() && data.env_template) {
          setEnvVars(data.env_template);
        }
      } else {
        toast.error('สแกนไม่สำเร็จ', { id: toastId, description: data.error });
      }
    } catch (err) {
      toast.error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ', { id: toastId, description: err.message });
    } finally {
      setInspecting(false);
    }
  };

  const handleSelectDatabase = (dbId) => {
    setSelectedDbId(dbId);
    if (!dbId) return;

    const db = databases.find(d => String(d.id) === String(dbId));
    if (!db) return;

    // สร้างชุดตัวแปรครบทุก Alias (DATABASE_URL, DB_URL, POSTGRES_URL และแยกชิ้น DB_HOST/PORT/USER/PASSWORD/NAME)
    const dbAliases = [
      `DATABASE_URL=${db.internal_url}`,
      `DB_URL=${db.internal_url}`,
      `POSTGRES_URL=${db.internal_url}`,
      `DB_HOST=${db.container_name}`,
      `DB_PORT=5432`,
      `DB_USER=postgres`,
      `DB_PASSWORD=${db.password}`,
      `DB_NAME=${db.dbname}`,
    ];

    const dbPrefixes = ['DATABASE_URL=', 'DB_URL=', 'POSTGRES_URL=', 'DB_HOST=', 'DB_PORT=', 'DB_USER=', 'DB_PASSWORD=', 'DB_NAME='];
    let remainingLines = envVars.split('\n').filter(line => {
      const trimmed = line.trim();
      return !dbPrefixes.some(prefix => trimmed.startsWith(prefix));
    });
    
    const combined = [...remainingLines.filter(l => l.trim()), ...dbAliases].join('\n');
    setEnvVars(combined);

    toast.success(`เชื่อมต่อกับ Database "${db.name}" สำเร็จ!`, {
      description: 'ระบบระบุตัวแปร DB ครบทุก Alias (DATABASE_URL, DB_URL, DB_HOST...) ให้อัตโนมัติแล้ว',
    });
  };

  // นับจำนวนการตั้งค่า Advanced ที่มีการใส่ค่าไว้
  const activeAdvancedCount = [Boolean(gitToken.trim()), Boolean(envVars.trim()), Boolean(forceAi), Boolean(selectedDbId)].filter(Boolean).length;

  const handleDeploy = async () => {
    const trimmedUrl = repoUrl.trim();
    if (!trimmedUrl) {
      toast.warning("กรุณาระบุ GitHub Repository", {
        description: "วางลิงก์โปรเจกต์ เช่น https://github.com/username/project",
      });
      return;
    }

    const isLikelyGitUrl = /^https?:\/\/.+/i.test(trimmedUrl) || /^git@.+/i.test(trimmedUrl);
    if (!isLikelyGitUrl) {
      toast.warning("รูปแบบ URL ไม่ถูกต้อง", {
        description: "กรุณาวางลิงก์ที่ถูกต้อง เช่น https://github.com/username/project",
      });
      return;
    }

    setIsLoading(true);
    setMessage('');
    setAiDockerfile('');
    setContainerId('');
    setPublicPort('');
    setDeployLogs(''); // ล้างหน้าจอ Terminal
    toast.info("เริ่มกระบวนการ Deploy...", {
      description: "กำลังเชื่อมต่อและวิเคราะห์โครงสร้างโค้ด",
    });

    try {
      const response = await fetch('http://localhost:8080/api/test-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          repo_url: repoUrl.trim(), 
          env_vars: envVars, 
          force_ai: forceAi,
          git_token: gitToken.trim()
        })
      });
      
      // เครื่องมือสำหรับอ่านข้อมูลแบบ Stream (สตรีมมิ่ง)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullLog = '';

      while (true) {
        // รอรับข้อมูลชิ้นใหม่ที่ Backend ดันผ่านท่อมา
        const { value, done } = await reader.read();
        if (done) break; // ถ้า Backend บอกว่า "จบแล้วท่อปิด" ก็ให้หยุด
        
        // ถอดรหัสข้อมูลและนำไปต่อท้ายข้อความเดิม
        const chunk = decoder.decode(value, { stream: true });
        fullLog += chunk;
        setDeployLogs(fullLog); // อัปเดตหน้าจอทันที
        
        // แอบเช็คว่าถ้ามีคำว่า SUCCESS โผล่มา แปลว่ารันเสร็จแล้ว
        if (chunk.includes("SUCCESS: DOMAIN=")) {
          const domainMatch = chunk.match(/DOMAIN=([a-zA-Z0-9.-]+)/);
          const idMatch = chunk.match(/ID=([a-zA-Z0-9]+)/);
          
          if (domainMatch) setPublicPort(domainMatch[1]);
          if (idMatch) setContainerId(idMatch[1]);
          
          setMessage("Deploy สำเร็จ! เซิร์ฟเวอร์ของคุณพร้อมใช้งานแล้ว");
          toast.success("Deploy สำเร็จเรียบร้อย!", {
            description: domainMatch ? `พร้อมเปิดใช้งานที่ ${domainMatch[1]}` : "เซิร์ฟเวอร์เริ่มทำงานแล้ว",
          });
        } else if (chunk.includes("Error:")) {
          setMessage("การ Deploy ล้มเหลว โปรดดู Log ด้านล่าง");
          toast.error("การ Deploy ล้มเหลว", {
            description: "โปรดดูรายละเอียดข้อผิดพลาดใน Terminal ด้านล่าง",
          });
        }
      }
    } catch (error) {
      setMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้: " + error.message);
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-4">
      <div className="bg-white/80 backdrop-blur-2xl p-8 md:p-10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden">
        
        {/* Decorative subtle ambient glows */}
        <div className="absolute top-0 right-0 -mt-24 -mr-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 mb-4">
            <Rocket className="w-7 h-7" />
          </div>
          <h3 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent mb-2">
            Deploy New Project
          </h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            วางลิงก์ GitHub แล้วให้ระบบ AI วิเคราะห์ สร้าง Container และเริ่มรันให้โดยอัตโนมัติ
          </p>
        </div>
        
        <div className="relative z-10 space-y-5">
          {/* Main Hero Input: GitHub URL */}
          <div className="group">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-blue-500" />
              GitHub Repository URL
            </label>
            <div className="relative">
              <input 
                type="text" 
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/project" 
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 pl-4 pr-32 py-3.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all shadow-xs text-base placeholder:text-slate-400 font-mono text-sm" 
              />
              <button
                type="button"
                onClick={() => handleInspectRepo()}
                disabled={inspecting || !repoUrl.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                {inspecting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Scanning...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                    <span>AI Scan</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Repository Insights Card */}
          {inspectResult && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-slate-50/80 border border-blue-200/80 shadow-xs space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">AI Code Analysis</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                    {inspectResult.detected_framework}
                  </span>
                  {inspectResult.has_database && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 flex items-center gap-1">
                      <Database className="w-3 h-3" /> Database Required
                    </span>
                  )}
                </div>
              </div>

              {inspectResult.detected_envs?.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1.5 font-medium">
                    <span>ตัวแปร Environment Variables ที่แอปนี้เรียกใช้ ({inspectResult.detected_envs.length} ตัว):</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAdvanced(true);
                        if (inspectResult.env_template) setEnvVars(inspectResult.env_template);
                        toast.success('นำค่า Template ใส่ใน .env แล้ว');
                      }}
                      className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Wand2 className="w-3 h-3" /> เติมลงใน .env
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {inspectResult.detected_envs.map(envKey => {
                      const isDbKey = inspectResult.db_var_names?.includes(envKey);
                      return (
                        <span 
                          key={envKey} 
                          className={`px-2.5 py-1 rounded-md border font-mono text-[11px] font-bold shadow-xs ${
                            isDbKey 
                              ? 'bg-amber-50 border-amber-300 text-amber-800' 
                              : 'bg-white border-blue-200 text-slate-700'
                          }`}
                        >
                          {envKey}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  ไม่พบตัวแปรจำเป็นพิเศษ สามารถกด Deploy ได้ทันที
                </p>
              )}

              {/* Database Link Suggestion */}
              {inspectResult.has_database && (
                <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      แอปนี้ต้องการ Database ({inspectResult.db_var_names?.join(', ') || 'DB_URL'})
                    </span>
                  </div>
                  {databases.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAdvanced(true);
                        if (databases[0]) handleSelectDatabase(databases[0].id);
                      }}
                      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs cursor-pointer shrink-0"
                    >
                      <Check className="w-3 h-3" />
                      <span>ผูกกับ {databases[0].name} ทันที</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-amber-700 font-medium">
                      (ยังไม่มี Managed DB ในระบบ ให้สร้างที่หน้า Dashboard)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Collapsible Advanced Configuration */}
          <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/40 transition-colors">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-100/60 transition-colors select-none"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">Advanced Configuration</span>
                <span className="text-xs text-slate-400 hidden sm:inline">(Environment, Private Repo, Build)</span>
                {activeAdvancedCount > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {activeAdvancedCount} active
                  </span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>

            {showAdvanced && (
              <div className="p-4 pt-2 border-t border-slate-200/70 space-y-4 bg-white/70 animate-in fade-in duration-200">
                {/* 1. Managed Database Attachment */}
                {databases.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-indigo-600" />
                        เชื่อมต่อ Managed Database <span className="text-[11px] font-normal text-slate-400">(Auto-Inject DATABASE_URL)</span>
                      </span>
                      {selectedDbId && (
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                          Auto-Linked
                        </span>
                      )}
                    </label>
                    <select
                      value={selectedDbId}
                      onChange={(e) => handleSelectDatabase(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-medium text-slate-700"
                    >
                      <option value="">-- ไม่เชื่อมต่อ (ระบุ DATABASE_URL เอง หรือไม่ใช้ DB) --</option>
                      {databases.map(db => (
                        <option key={db.id} value={db.id}>
                          {db.name} (Port :{db.host_port}) [{db.status}]
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">
                      ระบบจะเพิ่ม DATABASE_URL ลงใน .env ให้อัตโนมัติ
                    </p>
                  </div>
                )}

                {/* 2. Environment Variables */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    Environment Variables (.env)
                  </label>
                  <textarea
                    value={envVars}
                    onChange={(e) => setEnvVars(e.target.value)}
                    placeholder={"PORT=3000\nDATABASE_URL=postgres://...\nJWT_SECRET=supersecret"}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs text-slate-800 placeholder:text-slate-400"
                    rows="3"
                  ></textarea>
                  <p className="text-[11px] text-slate-400 mt-1">
                    ใส่บรรทัดละ 1 ตัวแปรในรูปแบบ KEY=VALUE
                  </p>
                </div>

                {/* 2. GitHub Token (Private Repo) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    Personal Access Token <span className="text-[11px] font-normal text-slate-400">(สำหรับ Private Repo)</span>
                  </label>
                  <div className="relative">
                    <input 
                      type={showToken ? "text" : "password"} 
                      value={gitToken}
                      onChange={(e) => setGitToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxx" 
                      className="w-full bg-slate-50/50 focus:bg-white border border-slate-200 text-slate-800 pl-3.5 pr-10 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-mono placeholder:text-slate-400 placeholder:font-sans" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                      title={showToken ? "ซ่อน Token" : "แสดง Token"}
                    >
                      {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Token ถูกเข้ารหัสอย่างปลอดภัยและไม่แสดงใน Log
                  </p>
                </div>

                {/* 3. Force AI Override */}
                <div className="flex items-center gap-2.5 pt-1">
                  <input 
                    type="checkbox" 
                    id="forceAi"
                    checked={forceAi}
                    onChange={(e) => setForceAi(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="forceAi" className="text-xs font-medium text-slate-700 cursor-pointer select-none">
                    <span className="font-semibold text-blue-600">Force AI Override:</span> บังคับให้ AI สร้าง Dockerfile ใหม่ทับของเดิม (หาก Dockerfile เดิม Build ไม่ผ่าน)
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          <button 
            onClick={handleDeploy}
            disabled={isLoading}
            className={`w-full group relative overflow-hidden flex items-center justify-center gap-2.5 font-semibold py-3.5 px-6 rounded-xl transition-all duration-300 shadow-md
              ${isLoading 
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none' 
                : 'bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white shadow-slate-900/15 hover:shadow-lg hover:shadow-slate-900/25 hover:-translate-y-0.5 cursor-pointer'}`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                <span>AI Analyzing & Building...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-blue-400 group-hover:text-blue-300 transition-colors" />
                <span>Analyze & Deploy</span>
              </>
            )}
          </button>

          {/* Terminal Log View (จะโชว์เฉพาะตอนที่มี Log) */}
          {deployLogs && (
            <div className="mt-8 bg-slate-900 rounded-xl p-4 overflow-hidden border border-slate-700 shadow-2xl text-left">
              {/* จุดสีๆ หัวหน้าต่างเหมือนของ Mac */}
              <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-2">
                <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-slate-400 text-xs font-mono ml-2">Deploy Terminal</span>
              </div>
              
              {/* พื้นที่โชว์ตัวหนังสือ (ใส่สีเขียวแบบ Hacker) */}
              <div className="h-64 overflow-y-auto font-mono text-xs md:text-sm text-emerald-400 whitespace-pre-wrap">
                {deployLogs}
              </div>
            </div>
          )}

          {/* Success/Error Message */}
          {message && (
            <div className={`mt-8 p-6 rounded-2xl border backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500
              ${containerId 
                ? 'bg-emerald-50/80 border-emerald-200/60' 
                : 'bg-rose-50/80 border-rose-200/60'}`}>
              
              <div className="flex items-start gap-4">
                {containerId ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
                )}
                
                <div className="flex-1">
                  <h4 className={`text-lg font-bold mb-1 ${containerId ? 'text-emerald-800' : 'text-rose-800'}`}>
                    {containerId ? 'Deployment Successful!' : 'Deployment Failed'}
                  </h4>
                  <p className={`font-medium ${containerId ? 'text-emerald-700' : 'text-rose-700'}`}>{message}</p>
                  
                  {containerId && (
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
                      <code className="text-sm px-3 py-1.5 bg-emerald-100/50 text-emerald-800 rounded-lg border border-emerald-200 font-mono">
                        ID: {containerId.substring(0, 12)}
                      </code>
                      
                      {publicPort && (
                        <a 
                          href={`http://${publicPort}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-emerald-500/20 hover:shadow-lg hover:-translate-y-0.5"
                        >
                          Open Live Site <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Dockerfile Output (macOS Terminal Style) */}
          {aiDockerfile && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
              <div className="flex items-center gap-2 mb-3 px-2">
                <Terminal className="w-5 h-5 text-indigo-500" />
                <h4 className="text-sm font-bold text-slate-700">AI Generated Dockerfile</h4>
              </div>
              
              <div className="rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/20 border border-slate-800 bg-[#1e1e1e]">
                {/* macOS Window Header */}
                <div className="bg-[#2d2d2d] border-b border-black/20 px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]"></div>
                  </div>
                  <div className="flex-1 text-center text-xs text-slate-400 font-medium">Dockerfile</div>
                </div>
                
                <div className="p-5 overflow-x-auto">
                  <pre className="text-[13px] leading-relaxed font-mono text-[#d4d4d4]">
                    <code>{aiDockerfile}</code>
                  </pre>
                </div>
              </div>
            </div>
          )}

        </div>
        
      </div>
    </div>
  );
};

export default DeployForm;