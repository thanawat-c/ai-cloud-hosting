import React from 'react';
import { X, Play } from 'lucide-react';

/**
 * DashboardAlertBanners renders proactive system health alerts:
 * 1. Crash/Stop alerts for containers with a shortcut to view logs or resume.
 * 2. Offline Database alerts notifying user when a linked PostgreSQL container is stopped.
 */
export const DashboardAlertBanners = ({
  crashedContainers = [],
  dismissAlert,
  setDismissAlert,
  dbDisconnectedContainers = [],
  dismissDbAlert,
  setDismissDbAlert,
  handleToggleDb,
}) => {
  return (
    <>
      {/* Alert Banner for stopped/crashed servers */}
      {crashedContainers.length > 0 && !dismissAlert && (
        <div className="mb-6 p-3.5 rounded-lg bg-neutral-950 border border-rose-900/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <div>
              <h4 className="font-medium text-rose-300 text-xs font-mono">
                Stopped Services ({crashedContainers.length})
              </h4>
              <p className="text-neutral-400 text-xs mt-0.5">
                Click <span className="text-neutral-200 font-mono">[Logs]</span> to view error details, or resume container.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissAlert(true)}
            className="text-neutral-500 hover:text-white p-1 rounded hover:bg-neutral-900 transition-colors cursor-pointer"
            title="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Alert Banner for disconnected databases */}
      {dbDisconnectedContainers.length > 0 && !dismissDbAlert && (
        <div className="mb-6 p-3.5 rounded-lg bg-neutral-950 border border-amber-900/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <div>
              <h4 className="font-medium text-amber-300 text-xs font-mono">
                Database Offline ({dbDisconnectedContainers.length} service affected)
              </h4>
              <p className="text-neutral-400 text-xs mt-0.5">
                Database <span className="text-neutral-200 font-mono">({dbDisconnectedContainers[0]?.linked_db_name || 'Database'})</span> is offline.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {dbDisconnectedContainers[0]?.linked_db_id && (
              <button
                type="button"
                onClick={() => handleToggleDb(dbDisconnectedContainers[0].linked_db_id, 'stopped')}
                className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                Resume DB
              </button>
            )}
            <button
              type="button"
              onClick={() => setDismissDbAlert(true)}
              className="text-neutral-500 hover:text-white p-1 rounded hover:bg-neutral-900 transition-colors cursor-pointer"
              title="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
