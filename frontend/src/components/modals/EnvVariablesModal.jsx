import React from 'react';
import { Settings, X, AlertCircle, CheckCircle2, Database } from 'lucide-react';
import { BulkEnvEditor } from '../common/BulkEnvEditor';

export const EnvVariablesModal = ({
  isOpen,
  onClose,
  activeEnvContainerName,
  envError,
  envSuccess,
  databases,
  currentEnvText,
  setCurrentEnvText,
  envSaving,
  handleSaveEnv,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col text-white">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">Environment Variables</h3>
              <p className="text-xs text-neutral-400 font-mono">{activeEnvContainerName}</p>
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
          {envError && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 flex items-start gap-2.5 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
              <span>{envError}</span>
            </div>
          )}

          {envSuccess && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-900/60 flex items-start gap-2.5 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
              <span>{envSuccess}</span>
            </div>
          )}

          <BulkEnvEditor
            value={currentEnvText}
            onChange={setCurrentEnvText}
            databases={databases}
            disabled={envSaving}
            minRows={8}
            placeholder={"DATABASE_URL=postgres://...\nPORT=8080\nSECRET_KEY=my_secret_token"}
          />
        </div>

        <div className="px-6 py-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 rounded-md transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveEnv}
            disabled={envSaving}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white hover:bg-neutral-200 disabled:opacity-50 text-black rounded-md text-xs font-medium border border-white transition-colors cursor-pointer"
          >
            {envSaving ? 'Saving & Restarting...' : 'Save & Restart'}
          </button>
        </div>
      </div>
    </div>
  );
};
