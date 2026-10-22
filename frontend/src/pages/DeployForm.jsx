import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Rocket, GitBranch, Terminal, CheckCircle2, XCircle, ExternalLink, 
  ChevronDown, Check, Copy, LayoutDashboard, AlertTriangle, RefreshCw,
  Sparkles, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '../context/WorkspaceContext';
import { DeployProgressModal } from '../components/modals';
import { PreFlightCard, BuildSettingsSection, AdvancedSettingsSection, DeploySuccessModal } from '../components/deploy';
import { apiFetch } from '../api/client';

const DeployForm = () => {
  const navigate = useNavigate();
  const { activeWorkspaceId, refreshWorkspaces } = useWorkspace();
  const resultRef = useRef(null);
  const logsEndRef = useRef(null);
  const terminalBoxRef = useRef(null);
  const liveModalTerminalRef = useRef(null);

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

  // Git Branch & Live Stream States
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [availableBranches, setAvailableBranches] = useState(['main']);
  const [isCustomBranch, setIsCustomBranch] = useState(false);
  const [deployStartTime, setDeployStartTime] = useState(null);
  const [deployElapsedTime, setDeployElapsedTime] = useState('00:00');
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deployStage, setDeployStage] = useState('cloning'); // 'cloning', 'inspecting', 'building', 'routing', 'done', 'error'

  // Build & Project Configuration States (Monorepo, Custom Commands)
  const [rootDir, setRootDir] = useState('');
  const [buildCmd, setBuildCmd] = useState('');
  const [installCmd, setInstallCmd] = useState('');
  const [startCmd, setStartCmd] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [nodeVersion, setNodeVersion] = useState('20');
  const [showBuildSettings, setShowBuildSettings] = useState(false);

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
    if (deployLogs) {
      if (terminalBoxRef.current) {
        terminalBoxRef.current.scrollTop = terminalBoxRef.current.scrollHeight;
      }
      if (liveModalTerminalRef.current) {
        liveModalTerminalRef.current.scrollTop = liveModalTerminalRef.current.scrollHeight;
      }
    }
  }, [deployLogs]);

  // Live Elapsed Timer
  useEffect(() => {
    let interval;
    if (isLoading && deployStartTime) {
      interval = setInterval(() => {
        const diffSec = Math.floor((Date.now() - deployStartTime) / 1000);
        const m = String(Math.floor(diffSec / 60)).padStart(2, '0');
        const s = String(diffSec % 60).padStart(2, '0');
        setDeployElapsedTime(`${m}:${s}`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isLoading, deployStartTime]);

  useEffect(() => {
    apiFetch('/databases')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDatabases(data);
      })
      .catch(err => console.error('Failed to load databases in deploy form:', err));
  }, [activeWorkspaceId]);

  const handleInspectRepo = useCallback(async (targetUrl) => {
    const url = (targetUrl || repoUrl).trim();
    if (!url) return;
    setInspecting(true);
    setInspectError('');
    try {
      const res = await apiFetch('/inspect-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: url, git_token: gitToken.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setInspectResult(data);
        setInspectError('');
        if (data.branches && data.branches.length > 0) {
          setAvailableBranches(data.branches);
          if (!data.branches.includes(selectedBranch)) {
            setSelectedBranch(data.default_branch || data.branches[0]);
          }
        }
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
  }, [repoUrl, gitToken, selectedBranch, selectedDbId, envVars]);

  // Debounced Auto-Inspect on URL change / paste
  useEffect(() => {
    const trimmed = repoUrl.trim();
    if (!trimmed || !trimmed.startsWith('http') || !trimmed.includes('github.com')) {
      const timer = setTimeout(() => {
        setInspectResult(null);
        setInspectError('');
      }, 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      handleInspectRepo(trimmed);
    }, 500);
    return () => clearTimeout(timer);
  }, [repoUrl, gitToken, handleInspectRepo]);

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
  const activeBuildCount = [Boolean(rootDir.trim()), Boolean(buildCmd.trim()), Boolean(installCmd.trim()), Boolean(startCmd.trim()), Boolean(outputDir.trim()), nodeVersion !== '20'].filter(Boolean).length;

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
    setDeployStartTime(Date.now());
    setDeployElapsedTime('00:00');
    setDeployStage('cloning');
    setDeployModalOpen(true);

    toast.info("Starting deployment...", {
      description: `Targeting branch: ${selectedBranch || 'main'}`,
    });

    try {
      const response = await apiFetch('/test-deploy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          repo_url: repoUrl.trim(), 
          branch: selectedBranch || 'main',
          env_vars: envVars, 
          force_ai: forceAi,
          git_token: gitToken.trim(),
          auto_create_db: autoCreateDb,
          workspace_id: activeWorkspaceId,
          root_dir: rootDir.trim(),
          build_cmd: buildCmd.trim(),
          install_cmd: installCmd.trim(),
          start_cmd: startCmd.trim(),
          output_dir: outputDir.trim(),
          node_version: nodeVersion,
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
        
        if (chunk.includes("Cloning repository")) {
          setDeployStage('cloning');
        } else if (chunk.includes("Packaging workspace") || chunk.includes("Auto-DB") || chunk.includes("Preparing")) {
          setDeployStage('inspecting');
        } else if (chunk.includes("Building Docker image") || chunk.includes("Step ") || chunk.includes("Building backend") || chunk.includes("Building frontend")) {
          setDeployStage('building');
        } else if (chunk.includes("Starting") || chunk.includes("Traefik") || chunk.includes("Binding") || chunk.includes("Syncing")) {
          setDeployStage('routing');
        }

        if (chunk.includes("SUCCESS: DOMAIN=")) {
          const domainMatch = chunk.match(/DOMAIN=([a-zA-Z0-9.-]+)/);
          const idMatch = chunk.match(/ID=([a-zA-Z0-9]+)/);
          
          if (domainMatch) setPublicPort(domainMatch[1]);
          if (idMatch) setContainerId(idMatch[1]);
          
          setDeployStage('done');
          setMessage("Deployment successful! Your server is ready.");
          toast.success("Deployment successful!", {
            description: domainMatch ? `Available at ${domainMatch[1]}` : "Server is now running",
          });
        } else if (chunk.includes("Error:") || chunk.includes("failed:") || chunk.includes("Error response from daemon:")) {
          setDeployStage('error');
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
      refreshWorkspaces();
      window.dispatchEvent(new CustomEvent('notification-refresh'));
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 150);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-2 sm:mt-4 px-1 sm:px-0">
      <div className="bg-[#0a0a0a] p-4 sm:p-7 md:p-10 rounded-xl border border-neutral-800 relative text-white">
        
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

          {/* Git Branch Selector */}
          <div className="pt-0.5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-300 font-mono flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-neutral-400" />
                <span>Git Branch</span>
              </label>
              <span className={`px-2 py-0.2 rounded-full text-[10px] font-mono font-medium ${
                selectedBranch === 'main' || selectedBranch === 'master'
                  ? 'bg-[#0070f3]/15 text-[#0070f3] border border-[#0070f3]/30'
                  : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
              }`}>
                {selectedBranch === 'main' || selectedBranch === 'master' ? '● Production Environment' : '● Preview Environment'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                {isCustomBranch ? (
                  <input
                    type="text"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    placeholder="e.g. main, staging, feature/login"
                    className="w-full bg-black border border-neutral-800 text-white px-3.5 py-2.5 rounded-md focus:outline-none focus:border-neutral-600 transition-colors text-xs font-mono"
                  />
                ) : (
                  <select
                    value={selectedBranch}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomBranch(true);
                        setSelectedBranch('');
                      } else {
                        setSelectedBranch(e.target.value);
                      }
                    }}
                    className="w-full bg-black border border-neutral-800 text-white px-3.5 py-2.5 rounded-md focus:outline-none focus:border-neutral-600 transition-colors text-xs font-mono appearance-none cursor-pointer"
                  >
                    {availableBranches.map((b) => (
                      <option key={b} value={b} className="bg-neutral-950 text-white">
                        {b} {b === 'main' || b === 'master' ? '(default)' : ''}
                      </option>
                    ))}
                    <option value="__custom__" className="bg-neutral-950 text-neutral-400">
                      + Custom Branch...
                    </option>
                  </select>
                )}
                {!isCustomBranch && (
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
              </div>

              {isCustomBranch && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomBranch(false);
                    setSelectedBranch(availableBranches[0] || 'main');
                  }}
                  className="px-3 py-2.5 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white text-xs font-mono transition-colors"
                >
                  Cancel
                </button>
              )}
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
          <PreFlightCard
            inspectResult={inspectResult}
            databases={databases}
            autoCreateDb={autoCreateDb}
            setAutoCreateDb={setAutoCreateDb}
            selectedDbId={selectedDbId}
            setSelectedDbId={setSelectedDbId}
            handleSelectDatabase={handleSelectDatabase}
            forceAi={forceAi}
            setForceAi={setForceAi}
          />

          {/* Collapsible Build & Output Settings (Vercel Style) */}
          <BuildSettingsSection
            showBuildSettings={showBuildSettings}
            setShowBuildSettings={setShowBuildSettings}
            activeBuildCount={activeBuildCount}
            rootDir={rootDir}
            setRootDir={setRootDir}
            buildCmd={buildCmd}
            setBuildCmd={setBuildCmd}
            outputDir={outputDir}
            setOutputDir={setOutputDir}
            installCmd={installCmd}
            setInstallCmd={setInstallCmd}
            startCmd={startCmd}
            setStartCmd={setStartCmd}
            nodeVersion={nodeVersion}
            setNodeVersion={setNodeVersion}
          />

          {/* Collapsible Advanced Configuration */}
          <AdvancedSettingsSection
            showAdvanced={showAdvanced}
            setShowAdvanced={setShowAdvanced}
            activeAdvancedCount={activeAdvancedCount}
            databases={databases}
            selectedDbId={selectedDbId}
            handleSelectDatabase={handleSelectDatabase}
            envVars={envVars}
            setEnvVars={setEnvVars}
            gitToken={gitToken}
            setGitToken={setGitToken}
            showToken={showToken}
            setShowToken={setShowToken}
            forceAi={forceAi}
            setForceAi={setForceAi}
          />

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

      {/* Deployment Success Modal */}
      <DeploySuccessModal
        showSuccessModal={showSuccessModal}
        setShowSuccessModal={setShowSuccessModal}
        inspectResult={inspectResult}
        repoUrl={repoUrl}
        publicPort={publicPort}
        copiedUrl={copiedUrl}
        handleCopyUrl={handleCopyUrl}
        navigate={navigate}
      />

      {/* Real-time Live Build Stepper & Terminal Modal */}
      <DeployProgressModal
        isOpen={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
        deployStage={deployStage}
        selectedBranch={selectedBranch}
        repoUrl={repoUrl}
        deployElapsedTime={deployElapsedTime}
        autoCreateDb={autoCreateDb}
        deployLogs={deployLogs}
        publicPort={publicPort}
        lastError={lastError}
        handleDeploy={handleDeploy}
        handleCopyUrl={handleCopyUrl}
        navigate={navigate}
        liveModalTerminalRef={liveModalTerminalRef}
        logsEndRef={logsEndRef}
      />

    </div>
  );
};

export default DeployForm;