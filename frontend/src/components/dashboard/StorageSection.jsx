import {
  Database,
  Plus,
  Play,
  Square,
  Trash2,
  Code,
  Link2,
  Archive,
  Download,
  Copy,
  Check,
  HardDrive,
} from 'lucide-react';

const StorageSection = ({
  databases,
  volumes,
  stats,
  onCreateDbClick,
  onCreateVolumeClick,
  handleToggleDb,
  handleDeleteDb,
  handleDetachVolume,
  handleDeleteVolume,
  handleOpenSqlStudio,
  handleOpenBindModal,
  handleOpenSnapshotModal,
  handleBackupDb,
  backingUpId,
  handleCopyUrl,
  copiedKey,
}) => {
  return (
    <div className="bg-[#0a0a0a] rounded-xl border border-neutral-800 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 bg-neutral-950/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 text-neutral-300 border border-neutral-800 flex items-center justify-center shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                Managed PostgreSQL Instances
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300">
                v16.2
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400">
                {databases.length} / 5 Active
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 font-mono truncate">
              Dedicated isolated memory • Persistent Docker Volume storage
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#00df8f] shadow-[0_0_8px_rgba(0,223,143,0.5)]"></span>
          <span>Cluster Online</span>
        </div>
      </div>

      {databases.length === 0 ? (
        <div className="p-8 sm:p-16 text-center bg-black">
          <div className="w-12 h-12 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 flex items-center justify-center mx-auto mb-3">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-medium text-white mb-1">No Managed Databases yet</h3>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto font-mono">
            Deploy a PostgreSQL 16 instance with 1 click, isolated memory, and persistent disk volume.
          </p>
          <button
            type="button"
            onClick={onCreateDbClick}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-black hover:bg-neutral-200 border border-white rounded-md text-xs font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Database</span>
          </button>
        </div>
      ) : (
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {databases.map((db) => {
            const isRunning = db.status === 'running';
            return (
              <div
                key={db.id}
                className="p-5 rounded-lg border border-neutral-800 bg-black hover:border-neutral-700 transition-colors flex flex-col justify-between text-neutral-200"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-neutral-900">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                        <Database className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white tracking-tight font-mono">
                          {db.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {isRunning ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-[#00df8f] shadow-[0_0_8px_rgba(0,223,143,0.5)]"></span>
                              <span className="text-[11px] font-mono text-[#00df8f]">Ready</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-neutral-600"></span>
                              <span className="text-[11px] font-mono text-neutral-500">Stopped</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions (Toggle/Delete) */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleDb(db.id, db.status)}
                        className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-colors cursor-pointer"
                        title={isRunning ? 'Stop Database' : 'Start Database'}
                      >
                        {isRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDb(db.id, db.name)}
                        className="p-1.5 rounded-md text-neutral-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/40 transition-colors cursor-pointer"
                        title="Delete Database"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Specs Tags (Vercel Style) */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
                      PostgreSQL 16
                    </span>
                    <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
                      Port {db.host_port}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                      512 MB Cap
                    </span>
                    {db.storage_usage && (
                      <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-emerald-400 font-mono">
                        Disk: {db.storage_usage}
                      </span>
                    )}
                  </div>

                  {/* Live RAM Stats */}
                  {isRunning && stats[db.container_id] && (
                    <div className="mb-3 p-2.5 rounded-md bg-neutral-950 border border-neutral-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-neutral-400">RAM Usage</span>
                        <span className="text-white font-medium">
                          {Number(stats[db.container_id].memory_mb || 0).toFixed(1)} / {stats[db.container_id].memory_limit || 512} MB
                        </span>
                      </div>
                      <div className="w-full bg-neutral-900 rounded-full h-1 overflow-hidden border border-neutral-800">
                        <div
                          className="bg-[#00df8f] h-1 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                3,
                                (Number(stats[db.container_id].memory_mb || 0) /
                                  (stats[db.container_id].memory_limit || 512)) *
                                  100
                              )
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Unified Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => handleOpenSqlStudio(db)}
                      disabled={!isRunning}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 text-neutral-200 hover:text-white rounded-md text-xs font-mono border border-neutral-800 transition-colors cursor-pointer"
                    >
                      <Code className="w-3.5 h-3.5 text-neutral-400" />
                      <span>SQL Studio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenBindModal(db)}
                      disabled={!isRunning}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 text-neutral-200 hover:text-white rounded-md text-xs font-mono border border-neutral-800 transition-colors cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Bind Server</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => handleOpenSnapshotModal(db)}
                      disabled={!isRunning}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 disabled:opacity-30 text-emerald-400 hover:text-emerald-300 rounded-md text-xs font-mono border border-emerald-800/60 transition-colors cursor-pointer"
                      title="Manage Database Snapshots & Instant Restore"
                    >
                      <Archive className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Snapshots</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBackupDb(db)}
                      disabled={!isRunning || backingUpId === db.id}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 text-neutral-300 hover:text-white rounded-md text-xs font-mono border border-neutral-800 transition-colors cursor-pointer"
                      title="Export immediate .sql dump"
                    >
                      <Download className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{backingUpId === db.id ? 'Exporting...' : 'Export .sql'}</span>
                    </button>
                  </div>

                  {/* Connection Strings */}
                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
                        <span>Internal URL (Apps)</span>
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(db.internal_url, `internal-${db.id}`)}
                          className="inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white font-mono transition-colors cursor-pointer"
                        >
                          {copiedKey === `internal-${db.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-[#00df8f]" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" /> Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="p-2 rounded bg-neutral-950 text-neutral-300 font-mono text-[11px] truncate select-all border border-neutral-800">
                        {db.internal_url}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">
                        <span>External URL (TablePlus / DBeaver)</span>
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(db.external_url, `external-${db.id}`)}
                          className="inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white font-mono transition-colors cursor-pointer"
                        >
                          {copiedKey === `external-${db.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-[#00df8f]" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" /> Copy
                            </>
                          )}
                        </button>
                      </div>
                      <div className="p-2 rounded bg-neutral-950 text-neutral-300 font-mono text-[11px] truncate select-all border border-neutral-800">
                        {db.external_url}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-neutral-900 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                  <span>
                    DB: <code className="text-neutral-400 font-mono">{db.database_name}</code>
                  </span>
                  <span>
                    User: <code className="text-neutral-400 font-mono">{db.username}</code>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Section 2: Persistent Volumes (Storage Disks) */}
      <div className="border-t border-neutral-800 bg-[#0a0a0a]">
        <div className="p-4 sm:p-6 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-cyan-400 border border-neutral-800 flex items-center justify-center shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                  Persistent Storage Volumes
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  {volumes?.length || 0} Volumes
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5 font-mono truncate">
                Stateful Docker disk volumes for user uploads, sqlite files, and media
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCreateVolumeClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-neutral-200 text-black text-xs font-semibold font-mono transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Volume</span>
          </button>
        </div>

        {(!volumes || volumes.length === 0) ? (
          <div className="p-8 text-center font-mono">
            <p className="text-xs text-neutral-500">No persistent volumes created yet.</p>
            <p className="text-[11px] text-neutral-600 mt-1">
              Create a volume to persist uploaded files across container deployments.
            </p>
          </div>
        ) : (
          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {volumes.map((vol) => (
              <div
                key={vol.id}
                className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex flex-col justify-between hover:border-neutral-700 transition-colors font-mono"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
                        <HardDrive className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-white text-xs truncate">{vol.name}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      vol.status === 'mounted' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                    }`}>
                      {vol.status === 'mounted' ? 'Mounted' : 'Available'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-neutral-400 mt-3 pt-2 border-t border-neutral-900">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Mount Path:</span>
                      <code className="text-neutral-300 bg-neutral-900 px-1.5 py-0.5 rounded">{vol.mount_path}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Attached Service:</span>
                      <span className="text-neutral-300 truncate max-w-[150px]">
                        {vol.service_name || (vol.container_id ? vol.container_id.substring(0, 12) : 'None')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Docker Volume:</span>
                      <span className="text-neutral-500 text-[10px] truncate max-w-[150px]">{vol.volume_name}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-900 flex items-center justify-between">
                  {vol.status === 'mounted' ? (
                    <button
                      type="button"
                      onClick={() => handleDetachVolume(vol.id)}
                      className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      Detach
                    </button>
                  ) : (
                    <span className="text-[10px] text-neutral-500">Ready to attach</span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteVolume(vol.id, vol.name)}
                    className="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Delete volume"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StorageSection;
