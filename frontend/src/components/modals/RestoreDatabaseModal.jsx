import { Upload, X } from 'lucide-react';

export const RestoreDatabaseModal = ({
  isOpen,
  onClose,
  activeRestoreDb,
  restoreFile,
  setRestoreFile,
  restoreResult,
  handleExecuteRestore,
  restoring,
}) => {
  if (!isOpen || !activeRestoreDb) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col text-white">
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Upload className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white tracking-tight">Restore Database</h3>
              <span className="px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-300 font-mono text-xs font-semibold border border-amber-800/60">
                {activeRestoreDb.name}
              </span>
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
          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200 leading-relaxed">
            SQL statements in the file will be executed directly against the database. Please verify your backup file before proceeding.
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-2">
              Select backup file (.sql):
            </label>
            <input
              type="file"
              accept=".sql,.dump"
              onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-neutral-400 font-mono file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-mono file:bg-neutral-800 file:text-white hover:file:bg-neutral-700 border border-neutral-800 rounded-md p-1 bg-black cursor-pointer"
            />
            {restoreFile && (
              <p className="text-[11px] text-emerald-400 mt-1 font-medium font-mono">
                Selected file: {restoreFile.name} ({(restoreFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {restoreResult && (
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-neutral-400 font-mono">Execution output:</span>
              <div className="p-3 rounded-xl bg-neutral-950 text-neutral-200 font-mono text-[11px] max-h-36 overflow-y-auto whitespace-pre-wrap border border-neutral-800">
                {restoreResult}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 rounded-md transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteRestore}
            disabled={restoring || !restoreFile}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-neutral-200 disabled:opacity-40 text-black rounded-md text-xs font-medium border border-white transition-colors cursor-pointer"
          >
            {restoring ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Restoring...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>Restore Data</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
