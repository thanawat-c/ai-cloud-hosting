import { useState, useEffect } from 'react';
import { Activity, X, Cpu, HardDrive, Server, Trash2, RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../../api/client';

export const HostHealthModal = ({ isOpen, onClose }) => {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pruning, setPruning] = useState(false);

  const fetchHealth = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await apiFetch('/system/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch {
      // silently fail on background poll
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => fetchHealth(true), 0);
      const interval = setInterval(() => fetchHealth(false), 3000);
      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }
  }, [isOpen]);

  const handlePrune = async () => {
    if (!window.confirm('Prune unused Docker images, build cache, and stopped containers to free disk space?')) return;
    setPruning(true);
    try {
      const res = await apiFetch('/system/prune', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to prune system');

      const mb = data.result?.space_reclaimed_mb || 0;
      toast.success(`Docker pruned! Reclaimed ${mb} MB of disk space.`, {
        description: `Removed ${data.result?.images_deleted || 0} images, ${data.result?.containers_deleted || 0} stopped containers`,
      });
      fetchHealth(false);
      window.dispatchEvent(new CustomEvent('notification-refresh'));
    } catch (err) {
      toast.error(err.message || 'Error pruning Docker system');
    } finally {
      setPruning(false);
    }
  };

  if (!isOpen) return null;

  const formatUptime = (seconds) => {
    if (!seconds) return '-';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-[#0a0a0a] border border-neutral-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white font-mono truncate">
                  Server Host Health & System Metrics
                </h2>
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 font-mono truncate">
                Real-time CPU, RAM, Disk & Docker Node status
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-mono">
          {loading && !health ? (
            <div className="flex items-center justify-center py-12 text-neutral-500 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Scanning host system metrics...</span>
            </div>
          ) : health ? (
            <>
              {/* Host Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800/80">
                  <span className="text-[10px] text-neutral-500 uppercase block">Operating System</span>
                  <span className="text-white font-semibold truncate block mt-0.5">
                    {health.platform || health.os} ({health.kernel_arch})
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800/80">
                  <span className="text-[10px] text-neutral-500 uppercase block">Host Uptime</span>
                  <span className="text-white font-semibold truncate block mt-0.5">
                    {formatUptime(health.uptime_seconds)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800/80">
                  <span className="text-[10px] text-neutral-500 uppercase block">Docker Engine</span>
                  <span className="text-emerald-400 font-semibold truncate block mt-0.5">
                    v{health.docker_server_version || 'Active'}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800/80">
                  <span className="text-[10px] text-neutral-500 uppercase block">Containers</span>
                  <span className="text-white font-semibold truncate block mt-0.5">
                    {health.docker_containers_running} active / {health.docker_containers_total} total
                  </span>
                </div>
              </div>

              {/* Resource Utilization Gauges */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800/80 space-y-4">
                <div className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Resource Utilization</span>
                  <span className="text-[10px] text-neutral-500 font-normal">Auto-refreshes every 3s</span>
                </div>

                {/* 1. CPU Usage */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-neutral-300 font-medium">
                      <Cpu className="w-3.5 h-3.5 text-neutral-400" />
                      <span>CPU Load ({health.cpu_cores} Cores)</span>
                    </span>
                    <span className={`font-bold ${health.cpu_usage >= 85 ? 'text-rose-400' : health.cpu_usage >= 65 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {health.cpu_usage}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-neutral-900 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${health.cpu_usage >= 85 ? 'bg-rose-500' : health.cpu_usage >= 65 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, Math.max(2, health.cpu_usage))}%` }}
                    />
                  </div>
                </div>

                {/* 2. Memory Usage */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-neutral-300 font-medium">
                      <Server className="w-3.5 h-3.5 text-neutral-400" />
                      <span>RAM: {(health.mem_used_mb / 1024).toFixed(1)} GB / {(health.mem_total_mb / 1024).toFixed(1)} GB</span>
                    </span>
                    <span className={`font-bold ${health.mem_usage >= 85 ? 'text-rose-400' : health.mem_usage >= 65 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {health.mem_usage}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-neutral-900 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${health.mem_usage >= 85 ? 'bg-rose-500' : health.mem_usage >= 65 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, Math.max(2, health.mem_usage))}%` }}
                    />
                  </div>
                </div>

                {/* 3. Disk Storage */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-neutral-300 font-medium">
                      <HardDrive className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Disk Space: {health.disk_used_gb} GB / {health.disk_total_gb} GB</span>
                    </span>
                    <span className={`font-bold ${health.disk_usage >= 85 ? 'text-rose-400' : health.disk_usage >= 65 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {health.disk_usage}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-neutral-900 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${health.disk_usage >= 85 ? 'bg-rose-500' : health.disk_usage >= 65 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, Math.max(2, health.disk_usage))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* One-Click Maintenance Banner */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800/80 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <Trash2 className="w-4 h-4 text-amber-400" />
                    <span>Docker System Maintenance</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                    Prune dangling images ({health.docker_images_count} total stored), build cache layers, and unused containers to immediately free up host disk space.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pruning}
                  onClick={handlePrune}
                  className="px-4 py-2 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {pruning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  <span>Prune System</span>
                </button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-neutral-500">
              Unable to reach host monitoring daemon
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-neutral-950/80 border-t border-neutral-800 shrink-0">
          <span className="text-[11px] text-neutral-500">
            Node status: Healthy • Host OS Kernel active
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-white hover:bg-neutral-200 text-black text-xs font-semibold font-mono transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
