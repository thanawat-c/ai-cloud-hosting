import React from 'react';
import { Database, Sparkles } from 'lucide-react';

/**
 * PreFlightCard displays detected repository architectural insights:
 * Framework identification, database requirements, 1-click auto-provisioning option, and AI Dockerfile toggles.
 */
export const PreFlightCard = ({
  inspectResult,
  databases,
  autoCreateDb,
  setAutoCreateDb,
  selectedDbId,
  setSelectedDbId,
  handleSelectDatabase,
  forceAi,
  setForceAi,
}) => {
  if (!inspectResult) return null;

  return (
    <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 text-xs space-y-3.5 animate-in fade-in duration-200">
      {/* Row 1: Framework & Architecture */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-900 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-neutral-400 font-mono">Detected Architecture:</span>
          <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-white font-mono font-medium text-xs">
            {inspectResult.detected_framework || 'Standard Project'}
          </span>
          {inspectResult.is_monorepo && (
            <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono text-[11px]">
              Fullstack Monorepo
            </span>
          )}
        </div>

        {inspectResult.detected_envs?.length > 0 && (
          <span className="text-[11px] text-neutral-500 font-mono">
            {inspectResult.detected_envs.length} env variables loaded
          </span>
        )}
      </div>

      {/* Row 2: Database Attachment & Auto-Provisioning */}
      {(inspectResult.has_database || (databases && databases.length > 0)) && (
        <div
          className={`p-3.5 rounded-md bg-black border space-y-3 transition-all ${
            inspectResult.has_database
              ? 'border-purple-500/40 ring-1 ring-purple-500/10'
              : 'border-neutral-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200 font-mono">
              <Database className="w-3.5 h-3.5 text-purple-400" />
              <span>Database Attachment:</span>
            </label>
            {inspectResult.has_database && (
              <span className="text-[10px] text-purple-300 font-mono font-medium px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30">
                ⚡ Required ({inspectResult.db_var_names?.join(', ') || 'DATABASE_URL'})
              </span>
            )}
          </div>

          {/* 1-Click Auto-Provision Card */}
          <div
            onClick={() => {
              const next = !autoCreateDb;
              setAutoCreateDb(next);
              if (next) setSelectedDbId('');
            }}
            className={`p-3 rounded-md border flex items-start gap-2.5 cursor-pointer transition-all ${
              autoCreateDb
                ? 'bg-purple-950/20 border-purple-500/60 text-white shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            <input
              type="checkbox"
              checked={autoCreateDb}
              onChange={(e) => {
                setAutoCreateDb(e.target.checked);
                if (e.target.checked) setSelectedDbId('');
              }}
              className="mt-0.5 rounded border-neutral-700 text-purple-600 focus:ring-0 cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-purple-200 font-mono">
                  Auto-create dedicated PostgreSQL Database
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono uppercase font-semibold">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 font-mono mt-1 leading-relaxed">
                Automatically provisions a dedicated database container, injects DATABASE_URL, and syncs schema/seed in one click.
              </p>
            </div>
          </div>

          {/* Manual / Existing DB Dropdown */}
          {!autoCreateDb && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] text-neutral-400 font-mono block">
                Or select an existing database in the cluster:
              </span>
              <select
                value={selectedDbId}
                onChange={(e) => handleSelectDatabase(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-neutral-800 bg-neutral-950 text-xs font-mono text-white focus:outline-none focus:border-neutral-600 cursor-pointer"
              >
                <option value="" className="bg-neutral-900 text-neutral-400">
                  -- Do not attach database (Configure manually via .env) --
                </option>
                {databases &&
                  databases.map((db) => (
                    <option key={db.id} value={db.id} className="bg-neutral-900 text-white">
                      {db.name} ({db.db_type || 'PostgreSQL'} :5432)
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Row 3: Build Mode (AI Dockerfile Switch) */}
      <div className="p-3 rounded-md bg-black border border-neutral-800 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white font-mono">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>AI Auto-Dockerize</span>
            {forceAi && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                Active
              </span>
            )}
          </div>
          <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
            {forceAi
              ? 'AI will generate a fresh, cloud-optimized Dockerfile for this build'
              : 'Use repository Dockerfile (or AI will generate one if none exists)'}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={forceAi}
            onChange={(e) => setForceAi(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-black"></div>
        </label>
      </div>
    </div>
  );
};
