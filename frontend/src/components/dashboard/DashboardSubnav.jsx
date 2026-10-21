import { Link } from 'react-router-dom';
import { Server, Database, Plus } from 'lucide-react';

const DashboardSubnav = ({
  activeTab,
  setSearchParams,
  containersCount,
  databasesCount,
  onCreateDbClick,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-800 pb-3">
      <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none">
        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'deployments' })}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer shrink-0 ${
            activeTab === 'deployments'
              ? 'bg-neutral-900 text-white border border-neutral-800'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-950 border border-transparent'
          }`}
        >
          <Server className="w-3.5 h-3.5 text-neutral-400" />
          <span>Deployments</span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              activeTab === 'deployments'
                ? 'bg-neutral-800 text-white'
                : 'bg-neutral-950 text-neutral-500'
            }`}
          >
            {containersCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'storage' })}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer shrink-0 ${
            activeTab === 'storage'
              ? 'bg-neutral-900 text-white border border-neutral-800'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-950 border border-transparent'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-neutral-400" />
          <span>Storage & Databases</span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              activeTab === 'storage'
                ? 'bg-neutral-800 text-white'
                : 'bg-neutral-950 text-neutral-500'
            }`}
          >
            {databasesCount}
          </span>
        </button>
      </div>

      <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
        {activeTab === 'deployments' ? (
          <Link
            to="/deploy"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-200 text-black border border-white rounded-md text-xs font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Deploy Service</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={onCreateDbClick}
            disabled={databasesCount >= 5}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-200 disabled:opacity-40 text-black border border-white rounded-md text-xs font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Database</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default DashboardSubnav;
