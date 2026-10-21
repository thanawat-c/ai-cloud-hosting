import React from 'react';
import { Terminal, X } from 'lucide-react';

export const ContainerLogsModal = ({
  isOpen,
  onClose,
  activeContainerName,
  logLoading,
  currentLogs,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-slate-700 flex flex-col h-[80vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
          <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-400" />
            Logs: {activeContainerName}
          </h3>
          <button 
            onClick={onClose} 
            className="text-neutral-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-[#0d1117] font-mono text-sm text-slate-300">
          {logLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="text-neutral-400 animate-pulse">Fetching latest logs...</p>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words">{currentLogs}</pre>
          )}
        </div>
      </div>
    </div>
  );
};
