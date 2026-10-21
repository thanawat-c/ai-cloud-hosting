import React from 'react';
import { 
  RotateCcw, 
  X, 
  Sparkles, 
  RefreshCw, 
  Archive, 
  GitCommit, 
  Check, 
  AlertCircle 
} from 'lucide-react';

export const DeploymentReleasesModal = ({
  isOpen,
  onClose,
  activeReleasesContainer,
  loadingReleases,
  releases,
  getGitCommitUrl,
  formatTimeAgo,
  confirmRollbackRelease,
  setConfirmRollbackRelease,
  rollingBackId,
  handleExecuteRollback,
}) => {
  if (!isOpen || !activeReleasesContainer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col max-h-[85vh] text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-800 bg-neutral-950 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <h3 className="text-base font-semibold text-white shrink-0">Deployment Releases</h3>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 shrink-0">
                  Instant Rollback
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5 truncate" title={`${activeReleasesContainer.clean_name || activeReleasesContainer.name} • ${activeReleasesContainer.branch || 'main'}`}>
                {activeReleasesContainer.clean_name || activeReleasesContainer.name} • {activeReleasesContainer.branch || 'main'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-900 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Info Box */}
          <div className="p-3.5 rounded-lg bg-neutral-900/60 border border-neutral-800/80 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-neutral-300 leading-relaxed">
              <p className="font-medium text-white mb-0.5">Zero-Downtime Instant Rollback</p>
              Past deployment releases preserve immutable Docker image tags. Rolling back points your live domain and container immediately to that verified build without rebuilding code or waiting for CI.
            </div>
          </div>

          {/* Releases Timeline */}
          {loadingReleases ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-neutral-400">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs font-mono">Loading release history...</span>
            </div>
          ) : releases.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center mb-3 text-neutral-500">
                <Archive className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-neutral-300">No releases found</p>
              <p className="text-xs text-neutral-500 max-w-sm mt-1">
                Releases are automatically recorded when new code is deployed or rebuilt via Webhook CI/CD.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-neutral-800">
              {releases.map((rel, index) => {
                const isActive = rel.is_active;
                const commitUrl = getGitCommitUrl(activeReleasesContainer.clean_name || activeReleasesContainer.name, rel.commit_hash);
                const shortHash = rel.commit_hash ? rel.commit_hash.slice(0, 7) : 'head';
                const isConfirming = confirmRollbackRelease?.id === rel.id;
                const isRollingBack = rollingBackId === rel.id;

                return (
                  <div key={rel.id} className="relative group">
                    {/* Timeline Node */}
                    <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isActive
                        ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                        : 'bg-neutral-900 border-neutral-700 group-hover:border-indigo-400'
                    }`}>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-black"></div>}
                    </div>

                    {/* Release Card */}
                    <div className={`rounded-xl p-4 border transition-all ${
                      isActive
                        ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                        : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1.5">
                          {/* Release Badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 text-xs font-mono font-semibold rounded-md ${
                              isActive
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                            }`}>
                              Release #{rel.release_num || (releases.length - index)}
                            </span>

                            {isActive && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-500 text-black font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse"></span>
                                Current Active
                              </span>
                            )}

                            {rel.commit_hash && (
                              <div className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-400">
                                <GitCommit className="w-3.5 h-3.5 text-neutral-500" />
                                {commitUrl ? (
                                  <a
                                    href={commitUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-neutral-300 hover:text-white hover:underline transition-colors"
                                  >
                                    {shortHash}
                                  </a>
                                ) : (
                                  <span>{shortHash}</span>
                                )}
                              </div>
                            )}

                            <span className="text-[11px] text-neutral-500 font-mono">
                              • {formatTimeAgo(rel.created_at)}
                            </span>
                          </div>

                          {/* Commit Message */}
                          <p className="text-sm font-medium text-neutral-200">
                            {rel.commit_message || 'Deployment release snapshot'}
                          </p>

                          {/* Author & Image Tag */}
                          <div className="flex items-center gap-3 text-xs text-neutral-400 pt-0.5">
                            {rel.author_name && (
                              <span className="flex items-center gap-1">
                                <span className="text-neutral-500">by</span>
                                <span className="text-neutral-300">{rel.author_name}</span>
                              </span>
                            )}
                            {(rel.image_tag || rel.image_name) && (
                              <span className="font-mono text-[11px] text-neutral-500 truncate max-w-[260px]" title={rel.image_tag || rel.image_name}>
                                image: {rel.image_tag || rel.image_name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="sm:self-center shrink-0">
                          {isActive ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 font-medium">
                              <Check className="w-4 h-4" />
                              <span>Live</span>
                            </div>
                          ) : isConfirming ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isRollingBack}
                                onClick={() => handleExecuteRollback(rel)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                              >
                                {isRollingBack ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Rolling back...</span>
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Confirm</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={isRollingBack}
                                onClick={() => setConfirmRollbackRelease(null)}
                                className="px-2.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRollbackRelease(rel)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Rollback</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Confirmation Alert Banner */}
                      {isConfirming && (
                        <div className="mt-3 pt-3 border-t border-neutral-800 flex items-start gap-2 text-xs text-amber-300 bg-amber-950/20 p-2.5 rounded-lg border-amber-500/20">
                          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                          <div>
                            Instant switch to Release #{rel.release_num || (releases.length - index)} ({shortHash}). Environment variables and custom domain configuration will be preserved.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500 font-mono">
            {releases.length} total release{releases.length === 1 ? '' : 's'} recorded
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 rounded-md transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
