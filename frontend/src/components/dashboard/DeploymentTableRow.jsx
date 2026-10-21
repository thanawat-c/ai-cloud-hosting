import {
  RefreshCw,
  ExternalLink,
  Shield,
  RotateCcw,
  GitBranch,
  MoreHorizontal,
  FileText,
  Activity,
  Globe,
  Settings,
  Webhook,
  Square,
  Play,
  Trash2,
} from 'lucide-react';

const getShortAppName = (rawName, cleanName) => {
  const nameToParse = cleanName || rawName?.replace(/\s*\((Backend|Frontend)\)$/, '') || '';
  if (!nameToParse) return 'Unknown App';
  let cleaned = nameToParse.replace(/\.git\/?$/, '');
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length > 0) cleaned = parts[parts.length - 1];
  }
  return cleaned;
};

const getGitCommitUrl = (repoUrl, commitHash) => {
  if (!repoUrl || !commitHash) return null;
  const clean = repoUrl.replace(/\.git\/?$/, '').replace(/\s*\((Backend|Frontend)\)$/, '').trim();
  if (clean.includes('github.com')) return `${clean}/commit/${commitHash}`;
  return null;
};

const getGitBranchUrl = (repoUrl, branch) => {
  if (!repoUrl || !branch) return null;
  const clean = repoUrl.replace(/\.git\/?$/, '').replace(/\s*\((Backend|Frontend)\)$/, '').trim();
  if (clean.includes('github.com')) return `${clean}/tree/${branch}`;
  return null;
};

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

const DeploymentTableRow = ({
  item,
  isMenuOpen,
  setActiveMenuId,
  containers,
  handleOpenDomainModal,
  handleOpenEnv,
  handleOpenProjectSettings,
  handleOpenReleasesModal,
  handleOpenWebhookModal,
  handleOpenMetrics,
  handleViewLogs,
  handleRedeploy,
  handleAction,
  handleDelete,
  setActiveErrorDetails,
  setActiveErrorContainerName,
  setErrorModalOpen,
}) => {
  const isRunning = item.state === 'running';
  const isCrashed = item.state === 'failed' || item.last_error || item.state === 'exited' || item.state === 'restarting';
  const isUpdating = item.state === 'redeploying';
  const isFrontend = item.service_type === 'frontend' || item.name?.includes('(Frontend)');
  const isDbStopped = isRunning && !isFrontend && item.is_db_stopped;
  const isDbMissing = isRunning && !isFrontend && (item.is_missing_db || (item.db_warning && !item.linked_db_name));
  const shortName = getShortAppName(item.name, item.clean_name);

  const description =
    item.service_type === 'backend' || item.name?.includes('(Backend)')
      ? 'Production API Server • Traefik Reverse Proxy'
      : item.service_type === 'frontend' || item.name?.includes('(Frontend)')
      ? 'Production Web UI • Nginx Static Routing'
      : 'Production Service • Docker Container';

  return (
    <tr className={`hover:bg-neutral-900/40 transition-colors group ${isMenuOpen ? 'relative z-30' : ''}`}>
      {/* 1. Deployment / Project Name with Tooltip */}
      <td className="px-3 sm:px-4 py-3.5 max-w-[150px] sm:max-w-[200px] lg:max-w-[260px]">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 76 65" fill="none" stroke="currentColor" strokeWidth="8" strokeLinejoin="round" className="w-3.5 h-3.5 text-[#00df8f]">
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {item.domain_name && isRunning ? (
                <a
                  href={`http://${item.domain_name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={shortName}
                  className="text-xs sm:text-sm font-medium text-white hover:underline truncate tracking-tight font-sans block"
                >
                  {shortName}
                </a>
              ) : (
                <span
                  title={shortName}
                  className="text-xs sm:text-sm font-medium text-white truncate tracking-tight font-sans block cursor-help"
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
              {item.custom_domain && (
                <button
                  type="button"
                  onClick={() => handleOpenDomainModal(item)}
                  title={`Domain: ${item.custom_domain} (${item.ssl_enabled ? 'HTTPS Active' : 'HTTP'})`}
                  className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0 inline-flex items-center gap-1 hover:bg-blue-500/20 transition-colors cursor-pointer"
                >
                  <Shield className={`w-2.5 h-2.5 ${item.ssl_enabled ? 'text-emerald-400' : 'text-neutral-400'}`} />
                  <span className="truncate max-w-[120px]">{item.custom_domain}</span>
                </button>
              )}
            </div>
            {/* Mobile helper under title */}
            <div className="sm:hidden flex items-center gap-1.5 text-[10px] font-mono text-neutral-500 mt-0.5 truncate">
              <span>{item.branch || 'main'}</span>
              <span>•</span>
              <span>{formatTimeAgo(item.deployed_at || item.created_at)}</span>
            </div>
          </div>
        </div>
      </td>

      {/* 2. Description / Commit */}
      <td className="hidden xl:table-cell px-4 py-3.5 text-xs text-neutral-400 truncate max-w-[180px] lg:max-w-[240px] font-sans" title={item.commit_message || description}>
        {item.commit_message ? (
          <span className="text-neutral-300 font-mono text-[11px] truncate block">
            {item.commit_message}
          </span>
        ) : (
          description
        )}
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
        ) : isDbMissing ? (
          <button
            type="button"
            onClick={() => handleOpenEnv(item.id, item.name)}
            className="flex items-center gap-1.5 text-xs font-mono text-amber-400 hover:text-amber-300 transition-colors group/warn cursor-pointer"
            title={item.db_warning || 'Database connection is missing! Click to connect.'}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
            <span className="font-medium text-amber-400">Missing DB</span>
            <span className="text-[10px] text-amber-300 bg-amber-950/80 border border-amber-800/80 px-1.5 py-0.2 rounded group-hover/warn:bg-amber-900 transition-colors">
              Connect
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

      {/* 4. Environment (Production vs Preview) */}
      <td className="hidden sm:table-cell px-4 py-3.5 whitespace-nowrap">
        {(() => {
          const isProd = !item.branch || item.branch === 'main' || item.branch === 'master';
          if (isRunning) {
            return isProd ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-[#0070f3] text-white shadow-[0_0_12px_rgba(0,112,243,0.25)]">
                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                Production
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-neutral-900 text-neutral-300 border border-neutral-700 shadow-[0_0_8px_rgba(168,85,247,0.15)]">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                Preview
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono text-[#888888] border border-[#333333] bg-transparent">
              <span className="w-1.5 h-1.5 rounded-full bg-[#666666]"></span>
              {isProd ? 'Production' : 'Preview'}
            </span>
          );
        })()}
      </td>

      {/* 5. Commit with GitHub Link */}
      <td className="hidden lg:table-cell px-4 py-3.5 whitespace-nowrap font-mono text-xs text-[#888888]">
        {(() => {
          const commitUrl = getGitCommitUrl(item.clean_name || item.name, item.commit_hash);
          const shortHash = item.commit_hash || (item.id ? item.id.substring(0, 7) : 'head');
          return (
            <div className="flex items-center gap-1.5" title={item.commit_message || `Commit: ${shortHash}`}>
              <button
                type="button"
                onClick={() => handleOpenReleasesModal(item)}
                className="text-[#666666] hover:text-indigo-400 font-mono text-xs flex items-center transition-colors cursor-pointer"
                title="View release history & rollback"
              >
                <RotateCcw className="w-3 h-3 text-neutral-500 hover:text-indigo-400" />
              </button>
              {commitUrl ? (
                <a
                  href={commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#a1a1a1] hover:text-white hover:underline transition-colors"
                >
                  {shortHash}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenReleasesModal(item)}
                  className="text-[#a1a1a1] hover:text-white transition-colors cursor-pointer"
                  title="View release history"
                >
                  {shortHash}
                </button>
              )}
            </div>
          );
        })()}
      </td>

      {/* 6. Branch with GitHub Link */}
      <td className="hidden lg:table-cell px-4 py-3.5 whitespace-nowrap font-mono text-xs text-[#888888]">
        {(() => {
          const branchName = item.branch || 'main';
          const branchUrl = getGitBranchUrl(item.clean_name || item.name, branchName);
          return (
            <div className="flex items-center gap-1.5" title={`Branch: ${branchName}`}>
              <GitBranch className="w-3.5 h-3.5 text-[#666666] shrink-0" />
              {branchUrl ? (
                <a
                  href={branchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#a1a1a1] hover:text-white hover:underline transition-colors"
                >
                  {branchName}
                </a>
              ) : (
                <span className="text-[#a1a1a1] hover:text-white transition-colors">{branchName}</span>
              )}
            </div>
          );
        })()}
      </td>

      {/* 7. Age */}
      <td className="hidden sm:table-cell px-3 sm:px-4 py-3.5 whitespace-nowrap font-mono text-xs text-neutral-500">
        {formatTimeAgo(item.deployed_at || item.created_at)}
      </td>

      {/* 8. Menu (...) & Visit & Avatar */}
      <td className={`px-3 sm:px-4 py-3.5 text-right whitespace-nowrap relative dropdown-menu-container ${isMenuOpen ? 'z-40' : ''}`}>
        <div className="inline-flex items-center justify-end gap-2.5">
          {/* Real Deployer Avatar or Initial */}
          <div
            className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-500 p-[1.5px] shrink-0 overflow-hidden"
            title={`Deployer: ${item.author_name || 'Developer'}`}
          >
            {item.author_avatar ? (
              <img
                src={item.author_avatar}
                alt={item.author_name || 'Deployer'}
                className="w-full h-full rounded-full object-cover bg-neutral-900"
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextSibling) {
                    e.target.nextSibling.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <div
              className={`w-full h-full bg-black rounded-full flex items-center justify-center text-[9px] font-mono font-bold text-white ${
                item.author_avatar ? 'hidden' : 'flex'
              }`}
            >
              {item.author_name ? item.author_name.charAt(0).toUpperCase() : 'D'}
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
                className={`absolute right-0 ${
                  containers.indexOf(item) >= containers.length - 2 && containers.length > 2
                    ? 'bottom-full mb-1.5'
                    : 'top-full mt-1.5'
                } w-48 bg-[#0a0a0a] border border-neutral-800 rounded-lg shadow-2xl z-50 py-1 text-left animate-in fade-in zoom-in-95 duration-100`}
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
                    handleOpenMetrics(item);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Live Metrics (CPU/RAM)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuId(null);
                    handleOpenDomainModal(item);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Custom Domain</span>
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
                    handleOpenProjectSettings(item);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Build & Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuId(null);
                    handleOpenWebhookModal(item);
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
                    handleOpenReleasesModal(item);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Rollback & Releases</span>
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
                    handleDelete(item.deployment_id || item.id);
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
};

export default DeploymentTableRow;
