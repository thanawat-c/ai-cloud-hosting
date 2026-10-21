import React from 'react';
import { SlidersHorizontal, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { BulkEnvEditor } from '../common/BulkEnvEditor';

/**
 * AdvancedSettingsSection renders optional deployment options:
 * Database binding, .env variable bulk editor, private GitHub token, and Dockerfile override.
 */
export const AdvancedSettingsSection = ({
  showAdvanced,
  setShowAdvanced,
  activeAdvancedCount,
  databases,
  selectedDbId,
  handleSelectDatabase,
  envVars,
  setEnvVars,
  gitToken,
  setGitToken,
  showToken,
  setShowToken,
  forceAi,
  setForceAi,
}) => {
  return (
    <div className="border border-neutral-800 rounded-md overflow-hidden bg-neutral-950">
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-neutral-900/80 transition-colors select-none cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-500 font-mono" />
          <span className="text-xs font-semibold text-neutral-300 font-mono">Advanced Settings</span>
          {activeAdvancedCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300">
              {activeAdvancedCount}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-neutral-500 font-mono transition-transform duration-200 ${
            showAdvanced ? 'rotate-180' : ''
          }`}
        />
      </button>

      {showAdvanced && (
        <div className="p-4 pt-2 border-t border-neutral-800 space-y-3 bg-neutral-950">
          {/* 1. Managed Database Attachment */}
          {databases && databases.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-neutral-300 font-mono mb-1">
                Connect Database:
              </label>
              <select
                value={selectedDbId}
                onChange={(e) => handleSelectDatabase(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-neutral-800 bg-black focus:outline-none focus:border-neutral-600 text-xs font-mono text-white transition-colors cursor-pointer"
              >
                <option value="" className="bg-neutral-900 text-neutral-400">
                  -- No Database Attached --
                </option>
                {databases.map((db) => (
                  <option key={db.id} value={db.id} className="bg-neutral-900 text-white">
                    {db.name} (Port :{db.host_port}) [{db.status}]
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 2. Environment Variables (.env Bulk Editor) */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 font-mono mb-1.5">
              Environment Variables (.env):
            </label>
            <BulkEnvEditor
              value={envVars}
              onChange={setEnvVars}
              databases={databases}
              minRows={4}
              placeholder={'PORT=3000\nDATABASE_URL=postgres://...\nJWT_SECRET=production_secret_key'}
            />
          </div>

          {/* 3. GitHub Token */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 font-mono mb-1">
              Personal Access Token (for Private Repositories):
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={gitToken}
                onChange={(e) => setGitToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full bg-black border border-neutral-800 text-white pl-3 pr-9 py-2 rounded-md focus:outline-none focus:border-neutral-600 text-xs font-mono placeholder:text-neutral-600 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 font-mono hover:text-neutral-400 font-mono transition-colors p-1"
                title={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* 4. Force Override */}
          <div className="flex items-center gap-2 pt-0.5">
            <input
              type="checkbox"
              id="forceAi"
              checked={forceAi}
              onChange={(e) => setForceAi(e.target.checked)}
              className="w-3.5 h-3.5 text-white bg-black rounded border-neutral-800 focus:ring-0 cursor-pointer"
            />
            <label htmlFor="forceAi" className="text-xs text-neutral-400 font-mono cursor-pointer select-none">
              Always generate new Dockerfile (override repository Dockerfile)
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
