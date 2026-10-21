import { AlertTriangle, X, Copy } from 'lucide-react';
import { toast } from 'sonner';

export const ErrorDetailsModal = ({
  isOpen,
  onClose,
  activeErrorContainerName,
  activeErrorDetails,
  extractCrashRootCause,
}) => {
  if (!isOpen) return null;

  const rootCause = extractCrashRootCause(activeErrorDetails);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col text-white">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">Deployment Error Details</h3>
              <p className="text-xs text-neutral-400 font-mono">{activeErrorContainerName}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 1. Highlighted Latest Root Cause Error on TOP */}
          <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-200 font-mono text-xs flex items-start gap-3 shadow-inner">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase text-rose-400">
                  Latest Root Cause Error
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(rootCause);
                    toast.success("Error copied to clipboard");
                  }}
                  className="text-[10px] text-rose-300 hover:text-white flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded bg-rose-900/50 border border-rose-800 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
              </div>
              <div className="font-semibold text-rose-100 text-xs break-words leading-relaxed">
                {rootCause}
              </div>
            </div>
          </div>

          {/* 2. Full Trace / Details */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-neutral-400 font-medium">Full Crash Log & Stack Trace:</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(activeErrorDetails || '');
                  toast.success("Full logs copied to clipboard");
                }}
                className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>Copy Full Logs</span>
              </button>
            </div>
            <div className="p-4 rounded-lg bg-black text-neutral-300 font-mono text-xs leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap break-words border border-neutral-800 shadow-inner">
              {/* eslint-disable-next-line no-control-regex */}
              {activeErrorDetails?.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '') || 'No details available'}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-neutral-200 text-black rounded-md text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
