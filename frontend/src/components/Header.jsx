import { Menu, Bell, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const Header = ({ setIsSidebarOpen }) => {
  const location = useLocation();
  const title = location.pathname === '/' ? 'Dashboard' : 'New Deploy';

  return (
    <header className="bg-slate-50/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-10">
      <div className="px-6 h-20 flex justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-200/50 transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h2>
            <p className="text-xs font-medium text-slate-500 hidden sm:block">Welcome back, let's build something awesome today.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          <div className="hidden md:flex relative group">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search resources..." 
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-full text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
            />
          </div>

          <button className="relative p-2.5 rounded-full text-slate-500 hover:bg-slate-200/50 hover:text-slate-700 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
