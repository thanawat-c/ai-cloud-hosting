import { 
  Database, 
  X, 
  Table, 
  Play, 
  Check, 
  Copy 
} from 'lucide-react';

export const WebSqlStudioModal = ({
  isOpen,
  onClose,
  activeSqlDb,
  sqlTables,
  sqlQuery,
  setSqlQuery,
  handleExecuteQuery,
  runningSql,
  sqlResult,
  handleCopyUrl,
  copiedKey,
}) => {
  if (!isOpen || !activeSqlDb) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col max-h-[90vh] text-white">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-neutral-900 text-neutral-300 border border-neutral-800">
              <Database className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white tracking-tight">SQL Studio</h3>
              <span className="px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-neutral-800 font-mono text-xs">
                {activeSqlDb.name}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-400 border border-neutral-800 font-mono text-xs">
                PostgreSQL 16
              </span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-neutral-400 hover:text-white p-1.5 rounded-md hover:bg-neutral-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 overflow-y-auto flex-1">
          {/* Tables Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-neutral-400 text-xs flex items-center gap-1.5 shrink-0">
              <Table className="w-3.5 h-3.5 text-indigo-400" />
              Tables:
            </span>
            {sqlTables.length === 0 ? (
              <span className="text-xs text-neutral-500 italic">No tables in database</span>
            ) : (
              sqlTables.map((tbl) => (
                <button
                  key={tbl}
                  type="button"
                  onClick={() => {
                    const query = `SELECT * FROM ${tbl} LIMIT 20;`;
                    setSqlQuery(query);
                    handleExecuteQuery(query);
                  }}
                  className="px-2.5 py-1 rounded-md bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 font-mono text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>{tbl}</span>
                </button>
              ))
            )}
          </div>

          {/* SQL Query Editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                SQL Query:
              </label>
              <div className="flex items-center gap-2">
                {sqlTables.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const query = `SELECT * FROM ${sqlTables[0]} LIMIT 20;`;
                      setSqlQuery(query);
                      handleExecuteQuery(query);
                    }}
                    className="text-[11px] text-neutral-400 hover:text-indigo-400 font-medium px-2 py-0.5 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    View {sqlTables[0]}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSqlQuery('')}
                  className="text-[11px] text-neutral-500 hover:text-rose-400 font-medium px-2 py-0.5 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleExecuteQuery();
                }
              }}
              rows="3"
              placeholder="Enter SQL query, e.g. SELECT * FROM ... or INSERT / UPDATE"
              className="w-full px-3.5 py-2.5 rounded-md border border-neutral-800 font-mono text-xs text-neutral-100 bg-black focus:border-neutral-600 focus:outline-none leading-relaxed"
            ></textarea>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] text-neutral-500">
                Press <kbd className="bg-neutral-900 px-1 py-0.5 rounded text-[10px] font-mono border border-neutral-800 text-neutral-400">⌘ + Enter</kbd> to run
              </span>
              <button
                type="button"
                onClick={() => handleExecuteQuery()}
                disabled={runningSql || !sqlQuery.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-neutral-200 disabled:opacity-40 text-black rounded-md text-xs font-medium border border-white transition-colors cursor-pointer"
              >
                {runningSql ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Query</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SQL Result View */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Result:
            </label>
            <div className="p-3.5 rounded-md bg-black text-emerald-400 font-mono text-xs leading-relaxed max-h-56 overflow-auto whitespace-pre border border-neutral-800">
              {runningSql ? (
                <span className="text-neutral-400">Loading data...</span>
              ) : (
                sqlResult || <span className="text-neutral-400">-- No rows returned --</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => handleCopyUrl(activeSqlDb.external_url, `ext-sql-${activeSqlDb.id}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 transition-colors cursor-pointer"
          >
            {copiedKey === `ext-sql-${activeSqlDb.id}` ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Connection URL Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Connection URL</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 rounded-md text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
