import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Rocket, X, Database, Plus, Terminal } from 'lucide-react';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();

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

        {/* Bottom Profile Area - Vercel Workspace */}
        <div className="p-3 border-t border-neutral-800">
          <div className="p-2 rounded-lg bg-neutral-950 border border-neutral-800/80 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 p-[1.5px] shrink-0">
              <div className="w-full h-full bg-black rounded-full flex items-center justify-center font-mono text-[10px] font-bold text-white">
                P
              </div>
            </div>
            <div className="flex-1 overflow-hidden min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-white truncate font-mono">Personal</p>
                <span className="text-[9px] px-1 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-mono uppercase">Pro</span>
              </div>
              <p className="text-[10px] text-neutral-500 truncate font-mono">Local Cluster • 8080</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
