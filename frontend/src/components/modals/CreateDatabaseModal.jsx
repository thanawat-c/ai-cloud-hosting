import React from 'react';
import { Database, X, Plus } from 'lucide-react';

export const CreateDatabaseModal = ({
  isOpen,
  onClose,
  handleCreateDatabase,
  newDbName,
  setNewDbName,
  creatingDb,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col text-white">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-neutral-900 text-neutral-300 border border-neutral-800">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">Create Managed Database</h3>
              <p className="text-xs text-neutral-400 font-mono">PostgreSQL 16 Alpine • Ready in 1-click</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreateDatabase}>
          <div className="p-6 space-y-4">
            {/* Database Name */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Database Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newDbName}
                onChange={(e) => setNewDbName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="e.g. prod-db, my-app-db"
                className="w-full px-3.5 py-2 rounded-md border border-neutral-800 bg-black text-white text-xs font-mono focus:border-neutral-600 focus:outline-none"
                autoFocus
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                Use lowercase alphanumeric characters, hyphens (-), and underscores (_)
              </p>
            </div>

            {/* Resource Summary Specs Card */}
            <div className="p-3.5 rounded-md bg-neutral-950 border border-neutral-800 space-y-2">
              <p className="text-xs font-semibold text-neutral-300">Specifications:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-md bg-black border border-neutral-800">
                  <div className="text-[10px] text-neutral-500 font-medium">RAM CAP</div>
                  <div className="text-xs font-bold text-indigo-400 mt-0.5">512 MB Max</div>
                </div>
                <div className="p-2 rounded-md bg-black border border-neutral-800">
                  <div className="text-[10px] text-neutral-500 font-medium">CPU LIMIT</div>
                  <div className="text-xs font-bold text-neutral-300 mt-0.5">1.0 Core</div>
                </div>
                <div className="p-2 rounded-md bg-black border border-neutral-800">
                  <div className="text-[10px] text-neutral-500 font-medium">STORAGE</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">Docker Volume</div>
                </div>
                <div className="p-2 rounded-md bg-black border border-neutral-800">
                  <div className="text-[10px] text-neutral-500 font-medium">NETWORK</div>
                  <div className="text-xs font-bold text-neutral-300 mt-0.5">ai-cloud-network</div>
                </div>
              </div>
              <p className="text-[11px] text-neutral-500 pt-0.5 leading-relaxed">
                A persistent volume will be attached and an external port automatically allocated (from 5433).
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
              type="submit"
              disabled={creatingDb || !newDbName.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-neutral-200 disabled:opacity-40 text-black rounded-md text-xs font-medium border border-white transition-colors cursor-pointer"
            >
              {creatingDb ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Database</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
