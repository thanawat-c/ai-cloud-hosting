import React from 'react';
import { 
  Archive, 
  X, 
  RefreshCw, 
  Plus, 
  AlertTriangle, 
  FileText, 
  Download, 
  Trash2, 
  Upload 
} from 'lucide-react';
import { toast } from 'sonner';

export const DatabaseSnapshotModal = ({
  isOpen,
  onClose,
  activeSnapshotDb,
  activeSnapshotTab,
  setActiveSnapshotTab,
  snapshots,
  snapshotNote,
  setSnapshotNote,
  takingSnapshot,
  handleTakeSnapshot,
  confirmRestoreSnapshot,
  setConfirmRestoreSnapshot,
  handleRestoreFromSnapshot,
  restoringSnapshotId,
  loadingSnapshots,
  handleDownloadSnapshot,
  handleDeleteSnapshot,
  deletingSnapshotId,
  restoreFile,
  setRestoreFile,
  restoreResult,
  setRestoreResult,
  restoring,
  setRestoring,
}) => {
  if (!isOpen || !activeSnapshotDb) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] w-full max-w-[940px] rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col text-white max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-800 bg-neutral-950 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 shrink-0">
              <Archive className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <h3 className="text-base font-semibold text-white tracking-tight shrink-0">Database Snapshots & Backups</h3>
                <span className="px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 font-mono text-xs truncate max-w-[180px] sm:max-w-xs md:max-w-sm" title={activeSnapshotDb.name}>
                  {activeSnapshotDb.name}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5 truncate">
                Safe point-in-time snapshots stored securely on server disk
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-header / Tabs & Quick Action */}
        <div className="p-3 sm:p-4 bg-neutral-900/40 border-b border-neutral-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSnapshotTab('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium font-mono transition-colors cursor-pointer whitespace-nowrap ${
                activeSnapshotTab === 'list'
                  ? 'bg-neutral-800 text-white border border-neutral-700'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              Snapshots History ({snapshots.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSnapshotTab('upload')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium font-mono transition-colors cursor-pointer whitespace-nowrap ${
                activeSnapshotTab === 'upload'
                  ? 'bg-neutral-800 text-white border border-neutral-700'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              Upload & Restore .sql
            </button>
          </div>

          {activeSnapshotTab === 'list' && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                value={snapshotNote}
                onChange={(e) => setSnapshotNote(e.target.value)}
                placeholder="Note (e.g. before schema update)..."
                className="flex-1 md:w-64 px-2.5 py-1.5 bg-black border border-neutral-800 rounded-md text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono min-w-0"
              />
              <button
                type="button"
                onClick={handleTakeSnapshot}
                disabled={takingSnapshot}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-semibold rounded-md text-xs font-mono transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {takingSnapshot ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Snapshot Now</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {activeSnapshotTab === 'list' ? (
            <div>
              {/* Inline Restore Confirmation Dialog */}
              {confirmRestoreSnapshot && (
                <div className="mb-4 p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-200 space-y-3 animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-amber-300">Confirm Database Restore</h4>
                      <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                        Restoring will overwrite current tables in <span className="font-mono text-white">"{activeSnapshotDb.name}"</span> with data from snapshot <span className="font-mono text-white font-semibold">"{confirmRestoreSnapshot.file_name}"</span>. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setConfirmRestoreSnapshot(null)}
                      className="px-3 py-1 text-xs text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800 rounded-md cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestoreFromSnapshot(confirmRestoreSnapshot)}
                      disabled={restoringSnapshotId === confirmRestoreSnapshot.id}
                      className="px-3.5 py-1 text-xs font-medium text-black bg-amber-400 hover:bg-amber-300 rounded-md cursor-pointer font-mono inline-flex items-center gap-1.5"
                    >
                      {restoringSnapshotId === confirmRestoreSnapshot.id ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Restoring...</span>
                        </>
                      ) : (
                        <span>Confirm & Restore Now</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {loadingSnapshots ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-500">
                  <RefreshCw className="w-6 h-6 animate-spin text-neutral-400" />
                  <span className="text-xs font-mono">Loading snapshots...</span>
                </div>
              ) : snapshots.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center border border-dashed border-neutral-800 rounded-xl bg-neutral-950/50 p-6 text-center">
                  <div className="p-3 rounded-full bg-neutral-900 text-neutral-500 mb-3 border border-neutral-800">
                    <Archive className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-medium text-white mb-1">No Snapshots Yet</h4>
                  <p className="text-xs text-neutral-400 max-w-sm mb-4">
                    Snapshots allow instant rollbacks before making schema changes or running batch scripts.
                  </p>
                  <button
                    type="button"
                    onClick={handleTakeSnapshot}
                    disabled={takingSnapshot}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-neutral-200 text-black rounded-md text-xs font-mono font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create First Snapshot</span>
                  </button>
                </div>
              ) : (
                <div className="border border-neutral-800 rounded-xl overflow-x-auto bg-neutral-950">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-900/60 text-neutral-400 font-mono text-[11px]">
                        <th className="py-2.5 px-4 font-medium">Snapshot</th>
                        <th className="py-2.5 px-3 font-medium whitespace-nowrap w-[150px]">Date & Time</th>
                        <th className="py-2.5 px-3 font-medium whitespace-nowrap w-[90px]">Size</th>
                        <th className="py-2.5 px-3 font-medium whitespace-nowrap w-[80px]">Type</th>
                        <th className="py-2.5 px-4 font-medium text-right whitespace-nowrap w-[170px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900 font-mono">
                      {snapshots.map((snap) => (
                        <tr key={snap.id} className="hover:bg-neutral-900/30 transition-colors">
                          <td className="py-3 px-4 max-w-[220px] sm:max-w-[300px]">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-neutral-200 font-semibold truncate" title={snap.file_name}>
                                  {snap.file_name}
                                </div>
                                {snap.notes && (
                                  <div className="text-[11px] text-neutral-400 font-sans mt-0.5 truncate" title={snap.notes}>
                                    {snap.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-neutral-400 text-[11px] whitespace-nowrap">
                            {new Date(snap.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="inline-block px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-800 text-[11px] font-mono whitespace-nowrap">
                              {snap.formatted_size || `${(snap.size_bytes / 1024).toFixed(1)} KB`}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase font-bold whitespace-nowrap">
                              {snap.type || 'manual'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setConfirmRestoreSnapshot(snap)}
                                title="Restore database from this snapshot"
                                className="px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/80 rounded text-[11px] font-medium transition-colors cursor-pointer inline-flex items-center gap-1 shrink-0"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Restore</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadSnapshot(activeSnapshotDb.id, snap)}
                                title="Download snapshot file (.sql)"
                                className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors cursor-pointer shrink-0"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSnapshot(snap.id)}
                                disabled={deletingSnapshotId === snap.id}
                                title="Delete snapshot"
                                className="p-1 text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed">
                SQL statements in the uploaded file will be executed directly against <span className="font-mono font-bold text-white">"{activeSnapshotDb.name}"</span>. Please verify your backup file before restoring.
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-2">
                  Select backup file (.sql):
                </label>
                <input
                  type="file"
                  accept=".sql,.dump"
                  onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-neutral-400 font-mono file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-mono file:bg-neutral-800 file:text-white hover:file:bg-neutral-700 border border-neutral-800 rounded-md p-1.5 bg-black cursor-pointer"
                />
                {restoreFile && (
                  <p className="text-[11px] text-emerald-400 mt-1.5 font-medium">
                    Selected file: {restoreFile.name} ({(restoreFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {restoreResult && (
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-neutral-400 font-mono">Execution output:</span>
                  <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-300 font-mono text-[11px] max-h-36 overflow-y-auto whitespace-pre-wrap">
                    {restoreResult}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!restoreFile || !activeSnapshotDb) {
                      toast.warning('Please select a .sql file to restore');
                      return;
                    }
                    setRestoring(true);
                    setRestoreResult('');
                    const toastId = toast.loading(`Restoring database into "${activeSnapshotDb.name}"...`);
                    const formData = new FormData();
                    formData.append('file', restoreFile);
                    try {
                      const res = await fetch(`http://localhost:8080/api/databases/${activeSnapshotDb.id}/restore`, {
                        method: 'POST',
                        body: formData,
                      });
                      const data = await res.json();
                      if (res.ok) {
                        toast.success('Database restored successfully!', { id: toastId });
                        setRestoreResult(data.output || 'Restore Completed Successfully.');
                        window.dispatchEvent(new CustomEvent('notification-refresh'));
                      } else {
                        toast.error('Database restore failed', { id: toastId, description: data.error });
                        setRestoreResult(`Error: ${data.error}\n${data.output || ''}`);
                      }
                    } catch (err) {
                      toast.error('Connection failed', { id: toastId, description: err.message });
                    } finally {
                      setRestoring(false);
                    }
                  }}
                  disabled={restoring || !restoreFile}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-neutral-200 disabled:opacity-40 text-black rounded-md text-xs font-semibold font-mono border border-white transition-colors cursor-pointer"
                >
                  {restoring ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Restoring...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Restore Uploaded .sql</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500 font-mono">
            Storage: Host sandboxed /data/backups/
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
