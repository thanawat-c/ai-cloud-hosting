import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Rocket, GitBranch, Terminal, CheckCircle2, XCircle, ExternalLink, 
  Search, Key, Eye, EyeOff, Lock, ChevronDown, SlidersHorizontal, 
  FileText, Database, Check, Copy, LayoutDashboard, X, AlertTriangle, RefreshCw,
  Sparkles, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const DeployForm = () => {
  const navigate = useNavigate();
  const resultRef = useRef(null);
  const logsEndRef = useRef(null);
  const terminalBoxRef = useRef(null);

  const [repoUrl, setRepoUrl] = useState('');
  const [gitToken, setGitToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [lastError, setLastError] = useState('');
  const [containerId, setContainerId] = useState('');
  const [aiDockerfile, setAiDockerfile] = useState(''); 
  const [publicPort, setPublicPort] = useState('');
  const [deployLogs, setDeployLogs] = useState('');
  const [envVars, setEnvVars] = useState("");
  const [forceAi, setForceAi] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [databases, setDatabases] = useState([]);
  const [selectedDbId, setSelectedDbId] = useState('');
  const [autoCreateDb, setAutoCreateDb] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState(null);
  const [inspectError, setInspectError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleCopyUrl = (url) => {
    if (!url) return;
    const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `http://${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(true);
    toast.success('URL copied to clipboard!');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const extractLastError = (logs) => {
    if (!logs) return '';
    const lines = logs.split('\n').map(l => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (
        line.startsWith('Error:') || 
        line.startsWith('Error ') || 
        line.includes('Error response from daemon:') ||
        line.includes('failed:') ||
        line.includes('COPY failed:') ||
        line.includes('npm ERR!')
      ) {
        return line.replace(/^Error:\s*/i, '');
      }
    }
    return lines[lines.length - 1] || 'Unknown build error occurred';
  };

  useEffect(() => {
    if (deployLogs && terminalBoxRef.current) {
      terminalBoxRef.current.scrollTop = terminalBoxRef.current.scrollHeight;
    }
  }, [deployLogs]);

  useEffect(() => {
    fetch('http://localhost:8080/api/databases')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDatabases(data);
      })
      .catch(err => console.error('Failed to load databases in deploy form:', err));
  }, []);

  // Debounced Auto-Inspect on URL change / paste
  useEffect(() => {
    const trimmed = repoUrl.trim();
    if (!trimmed || !trimmed.startsWith('http') || !trimmed.includes('github.com')) {
      setInspectResult(null);
      setInspectError('');
      return;
    }
    const timer = setTimeout(() => {
      handleInspectRepo(trimmed);
    }, 500);
    return () => clearTimeout(timer);
  }, [repoUrl, gitToken]);

  const handleInspectRepo = async (targetUrl) => {
    const url = (targetUrl || repoUrl).trim();
    if (!url) return;
    setInspecting(true);
    setInspectError('');
    try {
      const res = await fetch('http://localhost:8080/api/inspect-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: url, git_token: gitToken.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setInspectResult(data);
        setInspectError('');
        if (data.has_database && !selectedDbId) {
          setAutoCreateDb(true);
        }
        if (!envVars.trim() && data.env_template) {
          setEnvVars(data.env_template);
        }
      } else {
        setInspectError(data.error || 'Failed to scan repository');
        setInspectResult(null);
      }
    } catch (err) {
      setInspectError(err.message || 'Failed to connect to server');
      setInspectResult(null);
    } finally {
      setInspecting(false);
    }
  };

  const handleSelectDatabase = (dbId) => {
    setSelectedDbId(dbId);
    if (dbId) {
      setAutoCreateDb(false);
    }
    if (!dbId) return;

    const db = databases.find(d => String(d.id) === String(dbId));
    if (!db) return;

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

    toast.success(`Connected to database "${db.name}"!`, {
      description: 'Database environment variables added to .env',
    });
  };

  const activeAdvancedCount = [Boolean(gitToken.trim()), Boolean(envVars.trim()), Boolean(forceAi), Boolean(selectedDbId), Boolean(autoCreateDb)].filter(Boolean).length;

  const handleDeploy = async () => {
    const trimmedUrl = repoUrl.trim();
    if (!trimmedUrl) {
      toast.warning("Please specify a GitHub repository", {
        description: "Paste a repository link, e.g., https://github.com/username/project",
      });
      return;
    }

    const isLikelyGitUrl = /^https?:\/\/.+/i.test(trimmedUrl) || /^git@.+/i.test(trimmedUrl);
    if (!isLikelyGitUrl) {
      toast.warning("Invalid repository URL", {
        description: "Please enter a valid Git URL, e.g., https://github.com/username/project",
      });
      return;
    }

    setIsLoading(true);
    setMessage('');
    setLastError('');
    setShowSuccessModal(false);
    setAiDockerfile('');
    setContainerId('');
    setPublicPort('');
    setDeployLogs('');
    toast.info("Starting deployment...", {
      description: "Connecting and analyzing repository structure",
    });

    try {
      const response = await fetch('http://localhost:8080/api/test-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          repo_url: repoUrl.trim(), 
          env_vars: envVars, 
          force_ai: forceAi,
          git_token: gitToken.trim(),
          auto_create_db: autoCreateDb
        })
      });
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullLog = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullLog += chunk;
        setDeployLogs(fullLog);
        
        if (chunk.includes("SUCCESS: DOMAIN=")) {
          const domainMatch = chunk.match(/DOMAIN=([a-zA-Z0-9.-]+)/);
          const idMatch = chunk.match(/ID=([a-zA-Z0-9]+)/);
          
          if (domainMatch) setPublicPort(domainMatch[1]);
          if (idMatch) setContainerId(idMatch[1]);
          
          setMessage("Deployment successful! Your server is ready.");
          setShowSuccessModal(true);
          toast.success("Deployment successful!", {
            description: domainMatch ? `Available at ${domainMatch[1]}` : "Server is now running",
          });
        } else if (chunk.includes("Error:") || chunk.includes("failed:") || chunk.includes("Error response from daemon:")) {
          const detectedError = extractLastError(fullLog);
          setLastError(detectedError);
          setMessage("Deployment failed. Root cause details highlighted below.");
          toast.error("Deployment failed", {
            description: detectedError.substring(0, 90) + (detectedError.length > 90 ? '...' : ''),
          });
        }
      }
    } catch (error) {
      setLastError(error.message);
      setMessage("Failed to connect to server: " + error.message);
      toast.error("Failed to connect to server", {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 150);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-4">
      <div className="bg-[#0a0a0a] p-8 md:p-10 rounded-xl border border-neutral-800 relative text-white">
        
        {/* Decorative subtle ambient glows */}
        
        
        
        <div className="relative z-10 text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 text-white mb-3">
            <Rocket className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-semibold text-white tracking-tight mb-1">
            Deploy New Project
          </h3>
          <p className="text-neutral-400 text-xs max-w-sm mx-auto font-mono">
            Paste your GitHub repository link to automatically build and run your project.
          </p>
        </div>
        
        <div className="relative z-10 space-y-4">
          {/* Main Hero Input: GitHub URL */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 font-mono mb-1.5 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-neutral-300" />
              GitHub Repository URL
            </label>
            <div className="relative">
              <input 
                type="text" 
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/project" 
                className="w-full bg-black border border-neutral-800 text-white pl-3.5 pr-28 py-2.5 rounded-md focus:outline-none focus:border-neutral-600 transition-colors text-xs font-mono placeholder:text-neutral-600" 
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                {inspecting ? (
                  <div className="flex items-center gap-1.5 text-neutral-400 font-mono text-[11px]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400" />
                    <span>Scanning...</span>
                  </div>
                ) : inspectResult ? (
                  <div className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Ready</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Error Banner when repo fails pre-flight check */}
          {inspectError && (
            <div className="p-3.5 rounded-md bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200 flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-mono text-xs leading-relaxed">
                {inspectError}
              </div>
            </div>
          )}

          {/* Project Configuration & Insights Card (Auto-populated) */}
          {inspectResult && (
            <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 text-xs space-y-3.5 animate-in fade-in duration-200">
              
              {/* Row 1: Framework & Architecture */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-900 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-400 font-mono">Detected Architecture:</span>
                  <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-white font-mono font-medium text-xs">
                    {inspectResult.detected_framework || 'Standard Project'}
                  </span>
                  {inspectResult.is_monorepo && (
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono text-[11px]">
                      Fullstack Monorepo
                    </span>
                  )}
                </div>

                {inspectResult.detected_envs?.length > 0 && (
                  <span className="text-[11px] text-neutral-500 font-mono">
                    {inspectResult.detected_envs.length} env variables loaded
                  </span>
                )}
              </div>

              {/* Row 2: Database Attachment & Auto-Provisioning */}
              {(inspectResult.has_database || databases.length > 0) && (
                <div className={`p-3.5 rounded-md bg-black border space-y-3 transition-all ${
                  inspectResult.has_database ? 'border-purple-500/40 ring-1 ring-purple-500/10' : 'border-neutral-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200 font-mono">
                      <Database className="w-3.5 h-3.5 text-purple-400" />
                      <span>Database Attachment:</span>
                    </label>
                    {inspectResult.has_database && (
                      <span className="text-[10px] text-purple-300 font-mono font-medium px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30">
                        ⚡ Required ({inspectResult.db_var_names?.join(', ') || 'DATABASE_URL'})
                      </span>
                    )}
                  </div>

                  {/* 1-Click Auto-Provision Card */}
                  <div 
                    onClick={() => {
                      const next = !autoCreateDb;
                      setAutoCreateDb(next);
                      if (next) setSelectedDbId('');
                    }}
                    className={`p-3 rounded-md border flex items-start gap-2.5 cursor-pointer transition-all ${
                      autoCreateDb 
                        ? 'bg-purple-950/20 border-purple-500/60 text-white shadow-[0_0_15px_rgba(168,85,247,0.15)]' 
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <input 
                      type="checkbox"
                      checked={autoCreateDb}
                      onChange={(e) => {
                        setAutoCreateDb(e.target.checked);
                        if (e.target.checked) setSelectedDbId('');
                      }}
                      className="mt-0.5 rounded border-neutral-700 text-purple-600 focus:ring-0 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-purple-200 font-mono">
                          Auto-create dedicated PostgreSQL Database
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono uppercase font-semibold">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 font-mono mt-1 leading-relaxed">
                        Automatically provisions a dedicated database container, injects DATABASE_URL, and syncs schema/seed in one click.
                      </p>
                    </div>
                  </div>

                  {/* Manual / Existing DB Dropdown (Show when user unchecks auto-create or wants existing DB) */}
                  {!autoCreateDb && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] text-neutral-400 font-mono block">Or select an existing database in the cluster:</span>
                      <select
                        value={selectedDbId}
                        onChange={(e) => handleSelectDatabase(e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-neutral-800 bg-neutral-950 text-xs font-mono text-white focus:outline-none focus:border-neutral-600 cursor-pointer"
                      >
                        <option value="" className="bg-neutral-900 text-neutral-400">-- Do not attach database (Configure manually via .env) --</option>
                        {databases.map(db => (
                          <option key={db.id} value={db.id} className="bg-neutral-900 text-white">
                            {db.name} ({db.db_type || 'PostgreSQL'} :5432)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Row 3: Build Mode (AI Dockerfile Switch) */}
              <div className="p-3 rounded-md bg-black border border-neutral-800 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>AI Auto-Dockerize</span>
                    {forceAi && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                    {forceAi 
                      ? 'AI will generate a fresh, cloud-optimized Dockerfile for this build' 
                      : 'Use repository Dockerfile (or AI will generate one if none exists)'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    checked={forceAi} 
                    onChange={(e) => setForceAi(e.target.checked)} 
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-black"></div>
                </label>
              </div>

            </div>
          )}

          {/* Collapsible Advanced Configuration */}
          <div className="border border-neutral-800 rounded-md overflow-hidden bg-neutral-950">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-neutral-900/80 transition-colors select-none cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-500 font-mono" />
                <span className="text-xs font-semibold text-neutral-300 font-mono">Advanced Settings</span>
                {activeAdvancedCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300">
                    {activeAdvancedCount}
                  </span>
                )}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 font-mono transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>

            {showAdvanced && (
              <div className="p-4 pt-2 border-t border-neutral-800 space-y-3 bg-neutral-950">
                {/* 1. Managed Database Attachment */}
                {databases.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 font-mono mb-1">
                      Connect Database:
                    </label>
                    <select
                      value={selectedDbId}
                      onChange={(e) => handleSelectDatabase(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-neutral-800 bg-black focus:outline-none focus:border-neutral-600 text-xs font-mono text-white transition-colors"
                    >
                      <option value="" className="bg-neutral-900 text-neutral-400">-- No Database Attached --</option>
                      {databases.map(db => (
                        <option key={db.id} value={db.id} className="bg-neutral-900 text-white">
                          {db.name} (Port :{db.host_port}) [{db.status}]
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 2. Environment Variables */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 font-mono mb-1">
                    Environment Variables (.env):
                  </label>
                  <textarea
                    value={envVars}
                    onChange={(e) => setEnvVars(e.target.value)}
                    placeholder={"PORT=3000\nDATABASE_URL=postgres://..."}
                    className="w-full px-3 py-2 rounded-md border border-neutral-800 bg-black focus:outline-none focus:border-neutral-600 font-mono text-xs text-white placeholder:text-neutral-600 transition-colors"
                    rows="3"
                  ></textarea>
                </div>

                {/* 3. GitHub Token */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 font-mono mb-1">
                    Personal Access Token (for Private Repositories):
                  </label>
                  <div className="relative">
                    <input 
                      type={showToken ? "text" : "password"} 
                      value={gitToken}
                      onChange={(e) => setGitToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxx" 
                      className="w-full bg-black border border-neutral-800 text-white pl-3 pr-9 py-2 rounded-md focus:outline-none focus:border-neutral-600 text-xs font-mono placeholder:text-neutral-600 transition-colors" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 font-mono hover:text-neutral-400 font-mono transition-colors p-1"
                      title={showToken ? "Hide token" : "Show token"}
                    >
                      {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* 4. Force Override */}
                <div className="flex items-center gap-2 pt-0.5">
                  <input 
                    type="checkbox" 
                    id="forceAi"
                    checked={forceAi}
                    onChange={(e) => setForceAi(e.target.checked)}
                    className="w-3.5 h-3.5 text-white bg-black rounded border-neutral-800 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="forceAi" className="text-xs text-neutral-400 font-mono cursor-pointer select-none">
                    Always generate new Dockerfile (override repository Dockerfile)
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          <button 
            type="button"
            onClick={handleDeploy}
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-2 font-medium py-3 px-6 rounded-md transition-colors text-xs cursor-pointer ${
              isLoading 
                ? 'bg-neutral-900 text-neutral-500 border border-neutral-800 cursor-not-allowed' 
                : 'bg-white hover:bg-neutral-200 text-black border border-white font-semibold'}`}
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Building and deploying container...</span>
              </>
            ) : (
              <>
                <Rocket className="w-3.5 h-3.5" />
                <span>Deploy Project</span>
              </>
            )}
          </button>

          {/* Success / Error Card (Positioned directly under the button so it is immediately visible!) */}
          <div ref={resultRef}>
            {message && (
              <div className={`mt-5 p-5 md:p-6 rounded-2xl border backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm
                ${containerId 
                  ? 'bg-neutral-950 border-emerald-900/60' 
                  : 'bg-neutral-950 border-rose-900/60'}`}>
                
                <div className="flex items-start gap-3.5">
                  {containerId ? (
                    <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-500/20">
                      <XCircle className="w-5 h-5" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <h4 className={`text-base font-bold ${containerId ? 'text-emerald-300 font-mono' : 'text-rose-300 font-mono'}`}>
                        {containerId ? 'Deployment Successful!' : 'Deployment Failed'}
                      </h4>
                      {containerId ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold border border-emerald-200">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                          </span>
                          Live & Running
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-semibold border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Build Failed
                        </span>
                      )}
                    </div>
                    <p className={`text-xs ${containerId ? 'text-neutral-400 font-mono' : 'text-neutral-400 font-mono'}`}>{message}</p>
                    
                    {!containerId && lastError && (
                      <div className="mt-4 space-y-2.5 animate-in fade-in duration-200">
                        <div className="p-3.5 bg-rose-950/90 rounded-xl border border-rose-800 text-rose-100 shadow-sm">
                          <div className="flex items-center justify-between gap-2 mb-1.5 border-b border-rose-800/80 pb-1.5">
                            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-300">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                              Latest Error Details
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(lastError);
                                toast.success("Error copied to clipboard");
                              }}
                              className="text-[11px] font-mono text-rose-300 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-rose-900/60 hover:bg-rose-900 transition-colors cursor-pointer"
                              title="Copy error message"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copy Error</span>
                            </button>
                          </div>
                          <p className="font-mono text-xs text-rose-200 whitespace-pre-wrap break-all leading-relaxed select-all">
                            {lastError}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={handleDeploy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700 rounded-md text-xs font-medium transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
                            <span>Retry</span>
                          </button>
                          {!forceAi && (
                            <button
                              type="button"
                              onClick={() => {
                                setForceAi(true);
                                toast.info("Switched to ✨ AI Auto-Dockerize mode. Retrying deployment...");
                                setTimeout(() => handleDeploy(), 100);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-200 text-black border border-white rounded-md text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-black" />
                              <span>✨ Retry with AI Dockerfile</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {containerId && (
                      <div className="mt-4 space-y-3">
                        {publicPort && (
                          <div className="p-3 bg-white/80 rounded-xl border border-emerald-200/80 flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 font-mono mb-0.5">Live Gateway Endpoint</span>
                              <span className="font-mono text-xs font-bold text-slate-900 truncate block">
                                http://{publicPort}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCopyUrl(publicPort)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white font-mono rounded-lg text-xs font-semibold transition-all cursor-pointer border border-neutral-700"
                                title="Copy public URL"
                              >
                                {copiedUrl ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-neutral-500 font-mono" />
                                    <span>Copy URL</span>
                                  </>
                                )}
                              </button>
                              <a 
                                href={`http://${publicPort}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm shadow-emerald-500/20 cursor-pointer"
                              >
                                <span>Open Site</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          <code className="px-2.5 py-1 bg-emerald-100/60 text-emerald-800 rounded-md border border-emerald-200 font-mono text-[11px]">
                            Container ID: {containerId.substring(0, 12)}
                          </code>
                          <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-neutral-300 font-mono rounded-md font-semibold text-[11px] transition-colors cursor-pointer"
                          >
                            <LayoutDashboard className="w-3 h-3 text-neutral-500 font-mono" />
                            <span>Go to Dashboard</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Terminal Log View */}
          {deployLogs && (
            <div className="mt-6 bg-black rounded-lg p-4 overflow-hidden border border-neutral-800 text-left">
              {/* Window Header */}
              <div className="flex items-center justify-between mb-3 border-b border-neutral-900 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-neutral-500 font-mono text-xs font-mono ml-2">Build & Deploy Logs</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(deployLogs);
                    toast.success('Logs copied to clipboard');
                  }}
                  className="text-neutral-500 font-mono hover:text-slate-200 text-[11px] font-mono flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Logs</span>
                </button>
              </div>
              
              {/* Terminal Logs Content */}
              <div 
                ref={terminalBoxRef}
                className="h-64 overflow-y-auto font-mono text-xs md:text-sm text-emerald-400 whitespace-pre-wrap"
              >
                {deployLogs}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* Dockerfile Output (macOS Terminal Style) */}
          {aiDockerfile && (
            <div className="mt-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
              <div className="flex items-center gap-2 mb-3 px-2">
                <Terminal className="w-5 h-5 text-indigo-500" />
                <h4 className="text-sm font-bold text-neutral-300 font-mono">AI Generated Dockerfile</h4>
              </div>
              
              <div className="rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/20 border border-slate-800 bg-[#1e1e1e]">
                {/* macOS Window Header */}
                <div className="bg-[#2d2d2d] border-b border-black/20 px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]"></div>
                  </div>
                  <div className="flex-1 text-center text-xs text-neutral-500 font-mono font-medium">Dockerfile</div>
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

      {/* Deployment Success Modal (Vercel-style: Pops up immediately with 0 scrolling needed) */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-[#0a0a0a] rounded-xl p-6 md:p-8 shadow-2xl border border-neutral-800 overflow-hidden text-center animate-in zoom-in-95 duration-200 text-white">
            
            {/* Ambient decorative background glow */}
            <div className="absolute top-0 right-0 -mt-16 -mr-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1.5 rounded-full hover:bg-neutral-800 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon / Status badge */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 mb-4 animate-in bounce-in duration-300">
                <Rocket className="w-7 h-7" />
              </div>

              {(() => {
                const isBackend = Boolean(
                  inspectResult?.detected_framework?.toLowerCase().includes('backend') ||
                  inspectResult?.detected_framework?.toLowerCase().includes('go') ||
                  inspectResult?.detected_framework?.toLowerCase().includes('express') ||
                  inspectResult?.detected_framework?.toLowerCase().includes('fastapi') ||
                  inspectResult?.detected_framework?.toLowerCase().includes('nest') ||
                  repoUrl.toLowerCase().includes('backend') ||
                  repoUrl.toLowerCase().includes('api') ||
                  publicPort?.toLowerCase().includes('backend')
                );

                return (
                  <>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-xs font-semibold border border-emerald-500/20 mb-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span>{isBackend ? 'Backend API Active' : 'Live & Healthy'}</span>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-1 tracking-tight">
                      {isBackend ? 'Backend API is Live!' : 'Your Project is Live!'}
                    </h3>
                    <p className="text-xs text-neutral-400 font-mono max-w-sm mb-5 leading-relaxed">
                      {isBackend 
                        ? 'API service is active. Because this is a headless backend service, you can copy the API Base URL below to configure your frontend or test endpoints.'
                        : 'Build and container initialization completed. Your service is now reachable via Traefik gateway.'}
                    </p>

                    {/* Endpoint Display Box */}
                    {publicPort && (
                      <div className="w-full bg-black border border-neutral-800 rounded-md p-3.5 mb-5 text-left">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 font-mono mb-1">
                          {isBackend ? 'API Base Endpoint' : 'Service Endpoint'}
                        </span>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-xs font-semibold text-white break-all select-all">
                            http://{publicPort}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyUrl(publicPort)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-neutral-200 hover:text-white font-mono rounded-md text-xs font-medium transition-colors shrink-0 cursor-pointer"
                          >
                            {copiedUrl ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-neutral-400 font-mono" />
                                <span>Copy URL</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Primary Action Buttons */}
                    <div className="w-full space-y-2.5">
                      {publicPort && (
                        <a
                          href={`http://${publicPort}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-neutral-200 text-black border border-white rounded-md font-medium text-xs transition-colors cursor-pointer"
                        >
                          <span>{isBackend ? 'Test Root Endpoint (/)' : 'Open Live Site'}</span>
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}

                      <div className="flex items-center gap-2 w-full">
                        <button
                          type="button"
                          onClick={() => navigate('/')}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 rounded-md font-medium text-xs transition-colors cursor-pointer"
                        >
                          <LayoutDashboard className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Go to Dashboard</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSuccessModal(false)}
                          className="flex-1 py-2.5 px-4 border border-neutral-800 hover:bg-neutral-900 text-neutral-300 hover:text-white rounded-md font-medium text-xs transition-colors cursor-pointer"
                        >
                          View Logs
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}

            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default DeployForm;