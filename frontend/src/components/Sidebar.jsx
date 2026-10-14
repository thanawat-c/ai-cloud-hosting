import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Rocket, X, Cloud } from 'lucide-react';

const Sidebar = ({ isOpen, setIsOpen }) => {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-72 bg-slate-900/95 backdrop-blur-xl text-slate-300 flex flex-col
        border-r border-slate-800 shadow-2xl lg:shadow-none
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo Area */}
        <div className="h-20 flex items-center justify-between px-8 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">AI-Cloud</h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Platform</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Menu</p>
          
          <NavLink 
            to="/" 
            onClick={() => setIsOpen(false)}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
              ${isActive 
                ? 'bg-blue-500/10 text-blue-400 font-medium border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'}
            `}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </NavLink>
          
          <NavLink 
            to="/deploy" 
            onClick={() => setIsOpen(false)}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
              ${isActive 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-lg shadow-blue-500/25 border border-transparent' 
                : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10 hover:border-white/20'}
            `}
          >
            <Rocket className={`w-5 h-5 ${!location.pathname.includes('/deploy') && 'text-blue-400 group-hover:text-blue-300'}`} />
            New Deploy
            {!location.pathname.includes('/deploy') && (
              <span className="ml-auto flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            )}
          </NavLink>
        </nav>

        {/* Bottom Profile Area */}
        <div className="p-4 m-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
          <img src="https://ui-avatars.com/api/?name=User&background=3b82f6&color=fff" alt="User" className="w-10 h-10 rounded-full border-2 border-slate-700" />
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-slate-200 truncate">Kan (Admin)</p>
            <p className="text-xs text-slate-500 truncate">Pro Plan</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
