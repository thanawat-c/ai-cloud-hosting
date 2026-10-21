import { useState, useEffect, useCallback } from 'react';
import { History, X, Rocket, Database, HardDrive, Users, Shield, RefreshCw, Clock, Key } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '../../context/WorkspaceContext';
import { apiFetch } from '../../api/client';

export const AuditLogModal = ({ isOpen, onClose }) => {
  const { activeWorkspaceId, currentWorkspace } = useWorkspace();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('all');

  const fetchLogs = useCallback(async (type = filterType) => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    try {
      const endpoint = type && type !== 'all' 
        ? `/audit-logs?type=${type}`
        : '/audit-logs';
      const res = await apiFetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      }
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, filterType]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => fetchLogs(filterType), 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, fetchLogs, filterType]);

  if (!isOpen) return null;

  const getActionIcon = (resType) => {
    switch (resType) {
      case 'deployment':
      case 'container':
        return <Rocket className="w-3.5 h-3.5 text-blue-400" />;
      case 'database':
        return <Database className="w-3.5 h-3.5 text-purple-400" />;
      case 'volume':
        return <HardDrive className="w-3.5 h-3.5 text-cyan-400" />;
      case 'member':
        return <Users className="w-3.5 h-3.5 text-emerald-400" />;
      case 'token':
        return <Key className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Shield className="w-3.5 h-3.5 text-neutral-400" />;
    }
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const filterTabs = [
    { id: 'all', label: 'All Activities' },
    { id: 'deployment', label: 'Deployments' },
    { id: 'database', label: 'Databases' },
    { id: 'volume', label: 'Volumes' },
    { id: 'member', label: 'Members' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-3xl bg-[#0a0a0a] border border-neutral-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-blue-400">
              <History className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white font-mono truncate">
                  Audit Log & Activity Timeline
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-300 border border-neutral-800 font-mono">
                  {currentWorkspace?.name || activeWorkspaceId}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 font-mono truncate">
                Immutable compliance history of actions, deployments, and security events
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

        {/* Filter Bar */}
        <div className="px-5 py-2.5 border-b border-neutral-800 bg-neutral-950/60 flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-1.5 shrink-0">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                  filterType === tab.id
                    ? 'bg-neutral-800 text-white font-semibold'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => fetchLogs(filterType)}
            className="text-neutral-500 hover:text-white transition-colors flex items-center gap-1 text-[11px] font-mono shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 text-xs font-mono">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-neutral-500 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Fetching activity timeline...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-neutral-500">
              <History className="w-8 h-8 text-neutral-600 mx-auto mb-2 opacity-40" />
              <p>No audit events recorded for this category yet.</p>
              <p className="text-[10px] text-neutral-600 mt-1">
                Deployments, database operations, and member changes will be logged here automatically.
              </p>
            </div>
          ) : (
            <div className="relative border-l border-neutral-800 ml-4 space-y-6 my-2">
              {logs.map((log) => (
                <div key={log.id} className="relative pl-6 group">
                  {/* Timeline Node Dot */}
                  <div className="absolute -left-3 top-0.5 w-6 h-6 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center group-hover:border-neutral-600 transition-colors">
                    {getActionIcon(log.resource_type)}
                  </div>

                  {/* Card Content */}
                  <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800/80 hover:border-neutral-700 transition-colors space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{log.action}</span>
                        {log.resource_name && (
                          <span className="text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded text-[11px]">
                            {log.resource_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimestamp(log.created_at)}</span>
                      </div>
                    </div>

                    {log.details && (
                      <p className="text-neutral-400 text-[11px] leading-relaxed">
                        {log.details}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1 border-t border-neutral-900 mt-2">
                      <div className="flex items-center gap-2">
                        <span>Actor: <b className="text-neutral-400 font-normal">{log.actor_name || log.actor_email}</b></span>
                      </div>
                      <span className="text-neutral-600 font-mono">IP: {log.ip_address || '127.0.0.1'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-neutral-950/80 border-t border-neutral-800 shrink-0">
          <span className="text-[11px] text-neutral-500">
            Displaying latest {logs.length} audit entries • Encrypted ledger
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
