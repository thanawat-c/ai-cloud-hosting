import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Rocket, X, Database, Plus, Terminal, Check, ChevronsUpDown, Users, LogOut, Key } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '../context/WorkspaceContext';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const { workspaces, activeWorkspaceId, currentWorkspace, switchWorkspace } = useWorkspace();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 bg-black text-neutral-300 flex flex-col
        border-r border-neutral-800
        transform transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Vercel-style Logo Area */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            {/* Vercel Triangle Icon */}
            <div className="w-7 h-7 bg-white text-black flex items-center justify-center rounded-md font-black shadow-sm">
              <svg viewBox="0 0 76 65" fill="currentColor" className="w-4 h-4">
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-semibold text-white tracking-tight">AI Cloud</span>
              <span className="ml-1.5 text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                PRO
              </span>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)} 
            className="lg:hidden p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            Platform
          </div>
          
          <NavLink 
            to="/" 
            end
            onClick={() => setIsOpen(false)}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors
              ${isActive && !location.search.includes('tab=storage')
                ? 'bg-neutral-900 text-white border border-neutral-800' 
                : 'text-neutral-400 hover:text-white hover:bg-neutral-950 border border-transparent'}
            `}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Deployments</span>
          </NavLink>

          <NavLink 
            to="/?tab=storage" 
            onClick={() => setIsOpen(false)}
            className={() => `
              flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors
              ${location.search.includes('tab=storage')
                ? 'bg-neutral-900 text-white border border-neutral-800' 
                : 'text-neutral-400 hover:text-white hover:bg-neutral-950 border border-transparent'}
            `}
          >
            <Database className="w-4 h-4" />
            <span>Storage & Databases</span>
          </NavLink>

          <div className="pt-4 px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            Compute
          </div>

          <NavLink 
            to="/deploy" 
            onClick={() => setIsOpen(false)}
            className={({ isActive }) => `
              flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors
              ${isActive 
                ? 'bg-white text-black font-semibold' 
                : 'text-neutral-300 hover:text-white hover:bg-neutral-900 border border-neutral-800/80'}
            `}
          >
            <div className="flex items-center gap-2.5">
              <Rocket className="w-4 h-4" />
              <span>Deploy Service</span>
            </div>
            <Plus className="w-3.5 h-3.5 opacity-60" />
          </NavLink>
        </nav>

        {/* Bottom Profile Area - Interactive Workspace Switcher */}
        <div className="p-3 border-t border-neutral-800 relative">
          {workspaceMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-[#0a0a0a] border border-neutral-800 rounded-lg shadow-2xl p-1.5 z-50 text-xs font-mono animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1.5 text-[10px] text-neutral-500 uppercase tracking-wider flex items-center justify-between">
                <span>Switch Workspace</span>
                <span className="text-[9px] text-neutral-600 lowercase">{workspaces.length} active</span>
              </div>

              {workspaces.map((ws) => {
                const isSelected = ws.id === activeWorkspaceId;
                const isPersonal = ws.type === 'personal';
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => {
                      switchWorkspace(ws.id);
                      setWorkspaceMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded hover:bg-neutral-900 transition-colors cursor-pointer text-left ${
                      isSelected ? 'bg-neutral-900/60 text-white' : 'text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${
                        ws.color === 'emerald'
                          ? 'bg-gradient-to-tr from-emerald-500 to-cyan-500'
                          : ws.color === 'purple'
                          ? 'bg-purple-600'
                          : 'bg-blue-600'
                      }`}>
                        {isPersonal ? 'P' : <Users className="w-3 h-3" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium leading-tight truncate">{ws.name}</div>
                        <div className="text-[10px] text-neutral-500 font-mono">
                          {ws.deployments_count ?? 0} services • {ws.databases_count ?? 0} dbs
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1.5" />}
                  </button>
                );
              })}

              <div className="my-1 border-t border-neutral-800"></div>

              <button
                type="button"
                onClick={() => {
                  setWorkspaceMenuOpen(false);
                  toast.info('API Tokens: Auto-managed by local cluster.');
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-neutral-900 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
                <span>API Tokens</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setWorkspaceMenuOpen(false);
                  toast.success('Signed out. Local session refreshed.');
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-rose-950/40 text-rose-400 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setWorkspaceMenuOpen(prev => !prev)}
            className="w-full p-2 rounded-lg bg-neutral-950 border border-neutral-800/80 hover:border-neutral-700 flex items-center gap-2.5 text-left transition-colors cursor-pointer group"
          >
            <div className={`w-7 h-7 rounded-full p-[1.5px] shrink-0 ${
              currentWorkspace?.color === 'purple'
                ? 'bg-purple-600'
                : 'bg-gradient-to-tr from-emerald-500 to-cyan-500'
            }`}>
              <div className="w-full h-full bg-black rounded-full flex items-center justify-center font-mono text-[10px] font-bold text-white">
                {currentWorkspace?.type === 'personal' ? 'P' : <Users className="w-3 h-3 text-purple-300" />}
              </div>
            </div>
            <div className="flex-1 overflow-hidden min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-white truncate font-mono">{currentWorkspace?.name || 'Personal (Pro)'}</p>
                <span className="text-[9px] px-1 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-mono uppercase">
                  {currentWorkspace?.plan || 'Pro'}
                </span>
              </div>
              <p className="text-[10px] text-neutral-500 truncate font-mono">
                {currentWorkspace?.deployments_count ?? 0} Services • Local Cluster
              </p>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-300 shrink-0 transition-colors" />
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
