import React from 'react';
import { Rocket, ExternalLink, Copy, Check, LayoutDashboard, X } from 'lucide-react';

/**
 * DeploySuccessModal shows the instant completion dialog with live endpoint URL,
 * status indicator (differentiating backend APIs vs web apps), and quick action buttons.
 */
export const DeploySuccessModal = ({
  showSuccessModal,
  setShowSuccessModal,
  inspectResult,
  repoUrl,
  publicPort,
  copiedUrl,
  handleCopyUrl,
  navigate,
}) => {
  if (!showSuccessModal) return null;

  const isBackend = Boolean(
    inspectResult?.detected_framework?.toLowerCase().includes('backend') ||
    inspectResult?.detected_framework?.toLowerCase().includes('go') ||
    inspectResult?.detected_framework?.toLowerCase().includes('express') ||
    inspectResult?.detected_framework?.toLowerCase().includes('fastapi') ||
    inspectResult?.detected_framework?.toLowerCase().includes('nest') ||
    repoUrl?.toLowerCase().includes('backend') ||
    repoUrl?.toLowerCase().includes('api') ||
    publicPort?.toLowerCase().includes('backend')
  );

  return (
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
        </div>
      </div>
    </div>
  );
};
