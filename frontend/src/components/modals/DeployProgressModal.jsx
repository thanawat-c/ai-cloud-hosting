import { formatExternalUrl } from "../../utils/url";
import {
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  Copy,
  ExternalLink,
  LayoutDashboard,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

const DeployProgressModal = ({
  isOpen,
  onClose,
  deployStage,
  selectedBranch,
  repoUrl,
  deployElapsedTime,
  autoCreateDb,
  deployLogs,
  publicPort,
  lastError,
  handleDeploy,
  handleCopyUrl,
  navigate,
  liveModalTerminalRef,
  logsEndRef,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-black">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
                deployStage === 'done'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-[#00df8f]'
                  : deployStage === 'error'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-blue-500/10 border-blue-500/30 text-[#0070f3]'
              }`}
            >
              {deployStage === 'done' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : deployStage === 'error' ? (
                <XCircle className="w-4 h-4" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white font-mono">
                  {deployStage === 'done'
                    ? 'Deployment Ready'
                    : deployStage === 'error'
                    ? 'Deployment Failed'
                    : 'Deploying Application...'}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                    selectedBranch === 'main' || selectedBranch === 'master'
                      ? 'bg-[#0070f3]/20 text-[#0070f3] border border-[#0070f3]/30'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  }`}
                >
                  {selectedBranch}
                </span>
              </div>
              <p className="text-neutral-500 font-mono text-[11px] truncate max-w-sm sm:max-w-md">
                {repoUrl}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 font-mono text-xs flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-500" />
              <span>{deployElapsedTime}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (deployStage !== 'done' && deployStage !== 'error') {
                  toast.info('Deployment continuing in background. View status on the Dashboard.');
                }
              }}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              title={deployStage === 'done' || deployStage === 'error' ? 'Close' : 'Run in background'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stepper Pipeline Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-neutral-900 bg-neutral-950/80 text-[11px] font-mono">
          {[
            { id: 'cloning', label: '1. Git Clone', sub: selectedBranch },
            { id: 'inspecting', label: '2. Inspect & DB', sub: autoCreateDb ? 'Dedicated DB' : 'Env Scan' },
            { id: 'building', label: '3. Build Container', sub: 'Docker Engine' },
            { id: 'routing', label: '4. Assign Domain', sub: 'Active Proxy' },
          ].map((step, idx) => {
            const stageOrder = ['cloning', 'inspecting', 'building', 'routing', 'done'];
            const currentIdx = stageOrder.indexOf(deployStage === 'error' ? 'building' : deployStage);
            const stepIdx = idx;
            const isPassed = currentIdx > stepIdx || deployStage === 'done';
            const isCurrent = currentIdx === stepIdx && deployStage !== 'done' && deployStage !== 'error';
            const isFailed = deployStage === 'error' && currentIdx === stepIdx;

            return (
              <div
                key={step.id}
                className={`p-2.5 sm:p-3 border-r border-b sm:border-b-0 border-neutral-900 even:border-r-0 sm:even:border-r sm:last:border-r-0 transition-colors ${
                  isCurrent ? 'bg-neutral-900/60 text-white' : 'text-neutral-500'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isPassed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00df8f] shrink-0" />
                  ) : isFailed ? (
                    <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#0070f3] animate-spin shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-neutral-700 shrink-0"></div>
                  )}
                  <span
                    className={`truncate font-medium text-[11px] ${
                      isCurrent ? 'text-white' : isPassed ? 'text-neutral-300' : 'text-neutral-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                <span className="text-[10px] text-neutral-600 block pl-5 truncate">
                  {step.sub}
                </span>
              </div>
            );
          })}
        </div>

        {/* Embedded Live Terminal */}
        <div className="p-3 sm:p-4 bg-black flex-1 overflow-hidden flex flex-col min-h-[220px] sm:min-h-[260px] max-h-[380px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-neutral-400">
              <Terminal className="w-3.5 h-3.5 text-neutral-500" />
              <span className="font-mono text-xs font-medium text-neutral-300">Build Logs</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5"></span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(deployLogs);
                toast.success('Logs copied to clipboard');
              }}
              className="text-neutral-400 hover:text-white text-[11px] font-mono flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 transition-colors"
            >
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </button>
          </div>

          <div
            ref={liveModalTerminalRef}
            className="flex-1 overflow-y-auto font-mono text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed pr-2 select-text"
          >
            {deployLogs || (
              <div className="text-neutral-600 flex items-center gap-2 py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
                <span>Connecting to build pipeline...</span>
              </div>
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Modal Footer / Outcomes */}
        {deployStage === 'done' ? (
          <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="min-w-0">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                Live Production URL
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono font-bold text-white truncate">
                  http://{publicPort}
                </span>
                <button
                  onClick={() => handleCopyUrl(publicPort)}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white"
                  title="Copy URL"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={formatExternalUrl(publicPort)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-colors"
              >
                <span>Open Live Site</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-medium transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-neutral-400" />
                <span>Dashboard</span>
              </button>
            </div>
          </div>
        ) : deployStage === 'error' ? (
          <div className="p-4 border-t border-neutral-800 bg-rose-950/30 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-rose-400 font-semibold">
                Build Error Detected
              </span>
              <p className="text-xs font-mono text-rose-200 truncate mt-0.5">
                {lastError || 'Process terminated with errors'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDeploy}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-medium transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-md border border-neutral-800 hover:bg-neutral-800 text-neutral-400 text-xs font-mono transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between text-xs font-mono text-neutral-400">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0070f3] animate-pulse"></span>
              <span className="text-[11px] text-neutral-300">Building container in progress...</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                toast.info('Building in background. Check Dashboard for status.');
              }}
              className="text-[11px] text-neutral-400 hover:text-white transition-colors cursor-pointer hover:underline"
            >
              Run in background →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeployProgressModal;
