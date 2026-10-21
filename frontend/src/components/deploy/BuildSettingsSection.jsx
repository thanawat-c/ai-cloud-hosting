import React from 'react';
import { Folder, Terminal, Package, Play, Cpu, ChevronDown } from 'lucide-react';

/**
 * BuildSettingsSection renders customizable build commands and project directory settings
 * (Monorepo root, custom build/install/start commands, output dir, node version)
 */
export const BuildSettingsSection = ({
  showBuildSettings,
  setShowBuildSettings,
  activeBuildCount,
  rootDir,
  setRootDir,
  buildCmd,
  setBuildCmd,
  outputDir,
  setOutputDir,
  installCmd,
  setInstallCmd,
  startCmd,
  setStartCmd,
  nodeVersion,
  setNodeVersion,
}) => {
  return (
    <div className="border border-neutral-800 rounded-md overflow-hidden bg-neutral-950">
      <button
        type="button"
        onClick={() => setShowBuildSettings(!showBuildSettings)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-neutral-900/80 transition-colors select-none cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Folder className="w-3.5 h-3.5 text-neutral-400 font-mono" />
          <span className="text-xs font-semibold text-neutral-300 font-mono">Build and Output Settings</span>
          {activeBuildCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {activeBuildCount} customized
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-neutral-500 font-mono transition-transform duration-200 ${
            showBuildSettings ? 'rotate-180' : ''
          }`}
        />
      </button>

      {showBuildSettings && (
        <div className="p-4 pt-3 border-t border-neutral-800 space-y-3.5 bg-neutral-950 text-xs font-mono">
          {/* Root Directory */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-neutral-300 font-semibold flex items-center gap-1.5">
                <Folder className="w-3 h-3 text-neutral-400" />
                <span>Root Directory</span>
              </label>
              <span className="text-[10px] text-neutral-500">e.g. apps/web or frontend</span>
            </div>
            <input
              type="text"
              value={rootDir}
              onChange={(e) => setRootDir(e.target.value)}
              placeholder="./ (defaults to project root)"
              className="w-full px-3 py-2 rounded-md bg-black border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 text-xs font-mono"
            />
            <p className="text-[10px] text-neutral-500">
              Target subfolder for Monorepos or nested microservices.
            </p>
          </div>

          {/* Build Command */}
          <div className="space-y-1">
            <label className="text-neutral-300 font-semibold flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-neutral-400" />
              <span>Build Command</span>
            </label>
            <input
              type="text"
              value={buildCmd}
              onChange={(e) => setBuildCmd(e.target.value)}
              placeholder="e.g. npm run build, pnpm build, yarn build"
              className="w-full px-3 py-2 rounded-md bg-black border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 text-xs font-mono"
            />
          </div>

          {/* Grid: Output Dir & Install Cmd */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-neutral-300 font-semibold flex items-center gap-1.5">
                <Package className="w-3 h-3 text-neutral-400" />
                <span>Output Directory</span>
              </label>
              <input
                type="text"
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
                placeholder="e.g. dist, build, out"
                className="w-full px-3 py-2 rounded-md bg-black border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-neutral-300 font-semibold flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-neutral-400" />
                <span>Install Command</span>
              </label>
              <input
                type="text"
                value={installCmd}
                onChange={(e) => setInstallCmd(e.target.value)}
                placeholder="e.g. npm install, pnpm i"
                className="w-full px-3 py-2 rounded-md bg-black border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 text-xs font-mono"
              />
            </div>
          </div>

          {/* Grid: Start Cmd & Node Version */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-neutral-300 font-semibold flex items-center gap-1.5">
                <Play className="w-3 h-3 text-neutral-400" />
                <span>Start Command</span>
              </label>
              <input
                type="text"
                value={startCmd}
                onChange={(e) => setStartCmd(e.target.value)}
                placeholder="e.g. npm start, node server.js"
                className="w-full px-3 py-2 rounded-md bg-black border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-neutral-300 font-semibold flex items-center gap-1.5">
                <Cpu className="w-3 h-3 text-neutral-400" />
                <span>Node.js Version</span>
              </label>
              <select
                value={nodeVersion}
                onChange={(e) => setNodeVersion(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-black border border-neutral-800 text-white focus:outline-none focus:border-neutral-600 text-xs font-mono cursor-pointer"
              >
                <option value="20">20.x (Recommended)</option>
                <option value="22">22.x (Current)</option>
                <option value="18">18.x (Legacy LTS)</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
