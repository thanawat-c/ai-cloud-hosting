import React from 'react';
import { Link2, X } from 'lucide-react';

export const BindDatabaseModal = ({
  isOpen,
  onClose,
  activeBindDb,
  containers,
  selectedTargetContainer,
  setSelectedTargetContainer,
  handleConfirmBind,
  bindingServer,
  getShortAppName,
}) => {
  if (!isOpen || !activeBindDb) return null;

  const runningContainers = containers.filter(c => c.state === 'running');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col text-white">
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-neutral-900 text-neutral-300 border border-neutral-800">
              <Link2 className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white tracking-tight">Bind Database to Server</h3>
              <span className="px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-neutral-800 font-mono text-xs">
                {activeBindDb.name}
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
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-2">
              Select Target Server:
            </label>
            {runningContainers.length === 0 ? (
              <p className="text-xs text-rose-400 p-3 rounded-xl bg-rose-950/20 border border-rose-800/40">
                No running servers found. Please start a server first.
              </p>
            ) : (
              <select
                value={selectedTargetContainer}
                onChange={(e) => setSelectedTargetContainer(e.target.value)}
                className="w-full px-3.5 py-2 rounded-md border border-neutral-800 bg-black text-xs font-mono text-neutral-200 focus:border-neutral-600 focus:outline-none transition-colors"
              >
                {runningContainers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {getShortAppName(c.name, c.clean_name)} ({c.id.slice(0, 8)})
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-neutral-500 mt-2 leading-relaxed">
              The system will inject <code className="font-mono text-indigo-400 bg-neutral-900 px-1 py-0.5 rounded border border-neutral-800">DATABASE_URL</code> into the server and restart it automatically.
            </p>
          </div>
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
            onClick={handleConfirmBind}
            disabled={bindingServer || !selectedTargetContainer || runningContainers.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-neutral-200 disabled:opacity-40 text-black rounded-md text-xs font-medium border border-white transition-colors cursor-pointer"
          >
            {bindingServer ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Binding...</span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5" />
                <span>Bind to Server</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
