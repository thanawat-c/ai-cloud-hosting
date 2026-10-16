import { Menu, Bell, Search, Command } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

const Header = ({ setIsSidebarOpen }) => {
  const location = useLocation();
  const currentPath = location.pathname === '/' ? 'overview' : location.pathname.replace('/', '');

  return (
    <header className="bg-black/80 backdrop-blur-md border-b border-neutral-800 sticky top-0 z-20">
      <div className="px-6 h-16 flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-1.5 -ml-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          {/* Vercel Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <Link to="/" className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              <span className="font-semibold text-neutral-200">ai-cloud</span>
            </Link>
            <span className="text-neutral-600">/</span>
            <span className="text-neutral-400 uppercase tracking-wider">{currentPath}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search bar with ⌘K */}
          <div className="hidden sm:flex items-center relative">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search resources, apps..." 
              className="pl-8 pr-12 py-1.5 bg-neutral-950 border border-neutral-800 rounded-md text-xs text-neutral-200 placeholder:text-neutral-600 w-56 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600 transition-all font-mono"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-neutral-500 bg-neutral-900 border border-neutral-800 px-1 py-0.5 rounded">
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </div>
          </div>

          {/* Notifications */}
          <button 
            className="relative p-2 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
          </button>

          {/* Quick status pill */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-neutral-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Gateway 8080</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
