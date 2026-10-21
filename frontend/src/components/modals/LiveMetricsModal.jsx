import React from 'react';
import { Activity, X, Cpu, HardDrive } from 'lucide-react';

export const LiveMetricsModal = ({
  isOpen,
  onClose,
  metricsContainer,
  metricsData,
}) => {
  if (!isOpen || !metricsContainer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col text-white animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-black">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white font-mono">Real-time Performance Metrics</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <p className="text-neutral-500 font-mono text-[11px] truncate max-w-xs">
                {metricsContainer.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Stats */}
        <div className="p-6 space-y-5 bg-[#0a0a0a]">
          {/* CPU Usage Card */}
          <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                <span>CPU Usage</span>
              </span>
              <span className="font-bold text-white text-sm">
                {metricsData?.cpu_percent != null ? `${Number(metricsData.cpu_percent).toFixed(1)}%` : '0.0%'}
              </span>
            </div>
            <div className="w-full bg-neutral-900 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(2, Number(metricsData?.cpu_percent || 0)))}%` }}
              ></div>
            </div>
          </div>

          {/* Memory Usage Card */}
          <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-400 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Memory (RAM)</span>
              </span>
              <div className="text-right">
                <span className="font-bold text-white text-sm">
                  {metricsData?.memory_usage_mb != null ? `${Number(metricsData.memory_usage_mb).toFixed(1)} MB` : '0.0 MB'}
                </span>
                <span className="text-neutral-500 text-[11px] ml-1">
                  / {metricsData?.memory_limit_mb != null ? `${Number(metricsData.memory_limit_mb).toFixed(0)} MB` : '256 MB'}
                </span>
              </div>
            </div>
            <div className="w-full bg-neutral-900 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(100, Math.max(3, (Number(metricsData?.memory_usage_mb || 0) / Number(metricsData?.memory_limit_mb || 256)) * 100))}%` 
                }}
              ></div>
            </div>
          </div>

          {/* Network & Diagnostics Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="text-neutral-500 text-[10px] uppercase block mb-1">Status</span>
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Online / Healthy</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="text-neutral-500 text-[10px] uppercase block mb-1">Polling Rate</span>
              <span className="text-neutral-200">2.0s Live Stream</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500 font-mono">
            Container ID: {metricsContainer.id.substring(0, 12)}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-medium text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
