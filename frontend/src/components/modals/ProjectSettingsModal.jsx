import { useState, useEffect, useCallback } from 'react';
import { Settings, X, Folder, Terminal, Play, Package, Cpu, RefreshCw, Save, GitBranch, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '../../api/client';

export const ProjectSettingsModal = ({ isOpen, onClose, container, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [redeploying, setRedeploying] = useState(false);

  const [rootDir, setRootDir] = useState('');
  const [buildCmd, setBuildCmd] = useState('');
  const [installCmd, setInstallCmd] = useState('');
  const [startCmd, setStartCmd] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [nodeVersion, setNodeVersion] = useState('20');
  const [autoDeploy, setAutoDeploy] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!container?.id) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/containers/${container.id}/settings`);
      if (res.ok) {
        const data = await res.json();
        setRootDir(data.root_dir || '');
        setBuildCmd(data.build_cmd || '');
        setInstallCmd(data.install_cmd || '');
        setStartCmd(data.start_cmd || '');
        setOutputDir(data.output_dir || '');
        setNodeVersion(data.node_version || '20');
        setAutoDeploy(data.auto_deploy !== false);
      }
    } catch {
      // fallback to container object props
    } finally {
      setLoading(false);
    }
  }, [container]);

  useEffect(() => {
    if (isOpen && container) {
      const timer = setTimeout(() => {
        setRootDir(container.root_dir || '');
        setBuildCmd(container.build_cmd || '');
        setInstallCmd(container.install_cmd || '');
        setStartCmd(container.start_cmd || '');
        setOutputDir(container.output_dir || '');
        setNodeVersion(container.node_version || '20');
        setAutoDeploy(container.auto_deploy !== false);
        fetchSettings();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, container, fetchSettings]);

  const handleSave = async (triggerRedeploy = false) => {
    if (!container?.id) return;
    if (triggerRedeploy) setRedeploying(true);
    else setSaving(true);

    try {
      const res = await apiFetch(`/containers/${container.id}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          root_dir: rootDir.trim(),
          build_cmd: buildCmd.trim(),
          install_cmd: installCmd.trim(),
          start_cmd: startCmd.trim(),
          output_dir: outputDir.trim(),
          node_version: nodeVersion,
          auto_deploy: autoDeploy,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      toast.success('Project configuration saved');

      if (triggerRedeploy) {
        toast.info('Triggering redeploy with new build settings...');
        await apiFetch(`/containers/${container.id}/redeploy`, { method: 'POST' });
        toast.success('Redeploy started in background');
      }

      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error saving settings');
    } finally {
      setSaving(false);
      setRedeploying(false);
    }
  };

  if (!isOpen || !container) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl bg-[#0a0a0a] border border-neutral-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
              <Settings className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white font-mono truncate">
                Project & Build Configuration
              </h2>
              <p className="text-[11px] text-neutral-400 font-mono truncate">
                {container.clean_name || container.name || container.id}
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
          {loading && (
            <div className="flex items-center justify-center py-8 text-neutral-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-neutral-500" />
              <span>Loading current settings...</span>
            </div>
          )}

          {!loading && (
            <>
              {/* Root Directory */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-neutral-300 font-semibold flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Root Directory</span>
                  </label>
                  <span className="text-[10px] text-neutral-500">Relative to repo root</span>
                </div>
                <input
                  type="text"
                  value={rootDir}
                  onChange={(e) => setRootDir(e.target.value)}
                  placeholder="./ (defaults to repository root)"
                  className="w-full px-3 py-2 rounded-md bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 text-xs font-mono"
                />
                <p className="text-[10px] text-neutral-500 leading-relaxed">
                  Required if your code lives in a subfolder like <code className="text-neutral-300">frontend</code> or Monorepo packages like <code className="text-neutral-300">apps/web</code>.
                </p>
              </div>

              {/* Build Command */}
              <div className="space-y-1.5">
                <label className="text-neutral-300 font-semibold flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Build Command</span>
                </label>
                <input
                  type="text"
                  value={buildCmd}
                  onChange={(e) => setBuildCmd(e.target.value)}
                  placeholder="e.g. npm run build, pnpm build, yarn build"
                  className="w-full px-3 py-2 rounded-md bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 text-xs font-mono"
                />
                <p className="text-[10px] text-neutral-500">
                  Leave blank for automatic detection based on package.json scripts.
                </p>
              </div>

              {/* Output Directory & Install Command Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-neutral-300 font-semibold flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Output Directory</span>
                  </label>
                  <input
                    type="text"
                    value={outputDir}
                    onChange={(e) => setOutputDir(e.target.value)}
                    placeholder="e.g. dist, build, out"
                    className="w-full px-3 py-2 rounded-md bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-neutral-300 font-semibold flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Install Command</span>
                  </label>
                  <input
                    type="text"
                    value={installCmd}
                    onChange={(e) => setInstallCmd(e.target.value)}
                    placeholder="e.g. npm install, pnpm i"
                    className="w-full px-3 py-2 rounded-md bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Start Command & Node Version Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-neutral-300 font-semibold flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Start / Run Command</span>
                  </label>
                  <input
                    type="text"
                    value={startCmd}
                    onChange={(e) => setStartCmd(e.target.value)}
                    placeholder="e.g. npm start, node server.js"
                    className="w-full px-3 py-2 rounded-md bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-neutral-300 font-semibold flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Node.js Version</span>
                  </label>
                  <select
                    value={nodeVersion}
                    onChange={(e) => setNodeVersion(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-neutral-950 border border-neutral-800 text-white focus:outline-none focus:border-neutral-600 text-xs font-mono cursor-pointer"
                  >
                    <option value="20">20.x (LTS Recommended)</option>
                    <option value="22">22.x (Current)</option>
                    <option value="18">18.x (Legacy LTS)</option>
                  </select>
                </div>
              </div>

              {/* Auto Deploy Toggle */}
              <div className="pt-2 border-t border-neutral-800">
                <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800/80 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white font-mono">
                      <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Continuous Deployment (Auto-Deploy)</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                      Automatically re-build and redeploy this service whenever new commits are pushed to the target branch.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      checked={autoDeploy} 
                      onChange={(e) => setAutoDeploy(e.target.checked)} 
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-black"></div>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-950/80 border-t border-neutral-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving || redeploying}
              onClick={() => handleSave(false)}
              className="px-3.5 py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold font-mono transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Changes</span>
            </button>

            <button
              type="button"
              disabled={saving || redeploying}
              onClick={() => handleSave(true)}
              className="px-4 py-1.5 rounded-md bg-white hover:bg-neutral-200 text-black text-xs font-semibold font-mono transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {redeploying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              <span>Save & Redeploy</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
