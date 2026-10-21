import { useState, useEffect } from 'react';
import { HardDrive, X, Plus, Folder, Server, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '../../context/WorkspaceContext';

export const CreateVolumeModal = ({ isOpen, onClose, onCreated }) => {
  const { activeWorkspaceId } = useWorkspace();
  const [name, setName] = useState('');
  const [mountPath, setMountPath] = useState('/app/uploads');
  const [containerId, setContainerId] = useState('');
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingContainers, setFetchingContainers] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setMountPath('/app/uploads');
      setContainerId('');
      fetchContainers();
    }
  }, [isOpen, activeWorkspaceId]);

  const fetchContainers = async () => {
    setFetchingContainers(true);
    try {
      const res = await fetch('http://localhost:8080/api/containers', {
        headers: { 'X-Workspace-Id': activeWorkspaceId },
      });
      if (res.ok) {
        const data = await res.json();
        setContainers(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setFetchingContainers(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.warning('Please enter a volume name');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:8080/api/volumes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-Id': activeWorkspaceId,
        },
        body: JSON.stringify({
          name: name.trim(),
          mount_path: mountPath.trim() || '/app/uploads',
          container_id: containerId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create volume');

      toast.success('Persistent volume created successfully!');
      if (onCreated) onCreated();
      onClose();
      window.dispatchEvent(new CustomEvent('notification-refresh'));
    } catch (err) {
      toast.error(err.message || 'Error creating volume');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-[#0a0a0a] border border-neutral-800 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-cyan-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white font-mono truncate">
                Create Persistent Storage Volume
              </h2>
              <p className="text-[11px] text-neutral-400 font-mono truncate">
                Docker persistent disk for uploads, media & stateful data
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

        {/* Content Form */}
        <form onSubmit={handleCreate} className="p-5 space-y-4 text-xs font-mono">
          {/* Volume Name */}
          <div className="space-y-1.5">
            <label className="text-neutral-300 font-semibold block">Volume Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. user-uploads, app-data, media-storage"
              required
              className="w-full px-3 py-2 rounded-md bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 text-xs font-mono"
            />
            <p className="text-[10px] text-neutral-500">
              A unique identifier for this persistent disk.
            </p>
          </div>

          {/* Mount Path */}
          <div className="space-y-1.5">
            <label className="text-neutral-300 font-semibold block">Mount Destination Path</label>
            <input
              type="text"
              value={mountPath}
              onChange={(e) => setMountPath(e.target.value)}
              placeholder="/app/uploads"
              required
              className="w-full px-3 py-2 rounded-md bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 text-xs font-mono"
            />
            <p className="text-[10px] text-neutral-500">
              The internal path inside the container where data will be stored permanently (e.g. <code className="text-neutral-300">/app/uploads</code> or <code className="text-neutral-300">/var/data</code>).
            </p>
          </div>

          {/* Attach to Container */}
          <div className="space-y-1.5">
            <label className="text-neutral-300 font-semibold block">Attach to Service (Optional)</label>
            <select
              value={containerId}
              onChange={(e) => setContainerId(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-neutral-600 text-xs font-mono cursor-pointer"
            >
              <option value="">-- Leave Unmounted (Attach Later) --</option>
              {containers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.clean_name || c.name} ({c.id}) [{c.state}]
                </option>
              ))}
            </select>
          </div>

          {/* Info note */}
          <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-900 text-[11px] text-neutral-400 space-y-1">
            <div className="text-neutral-300 font-semibold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-cyan-400" />
              <span>Survives Rebuilds & Deployments</span>
            </div>
            <p className="text-neutral-500 text-[10px] leading-relaxed">
              Files written to this directory will persist safely on the host even when you rebuild, redeploy, or rollback your container.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold font-mono transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Create Volume</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
