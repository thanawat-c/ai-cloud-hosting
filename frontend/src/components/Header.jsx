import { useState, useEffect } from 'react';
import { Menu, Bell, Search, Command, X, Rocket, Database, LayoutDashboard, Sparkles, RefreshCw, Trash2, ArrowRight } from 'lucide-react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const Header = ({ setIsSidebarOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname === '/' ? 'overview' : location.pathname.replace('/', '');

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [containers, setContainers] = useState([]);

  // Listen for Cmd+K or Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch containers when palette opens
  useEffect(() => {
    if (paletteOpen) {
      fetch('http://localhost:8080/api/containers')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setContainers(data);
        })
        .catch(() => {});
    }
  }, [paletteOpen]);

  const quickNavItems = [
    { label: 'Deployments Overview', sub: 'View all active containers', path: '/', icon: LayoutDashboard },
    { label: 'Storage & Databases', sub: 'PostgreSQL instances & backups', path: '/?tab=storage', icon: Database },
    { label: 'Deploy New Project', sub: 'Launch repository from GitHub', path: '/deploy', icon: Rocket },
  ];

  const filteredNav = quickNavItems.filter(item => 
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.sub.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredContainers = containers.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.clean_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.domain_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePruneSystem = async () => {
    setPaletteOpen(false);
    toast.info('Cleaning up unused Docker images...');
    try {
      const res = await fetch('http://localhost:8080/api/system/prune', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Cleanup complete: Reclaimed ${data.space_reclaimed_mb} MB`);
      } else {
        toast.error('Cleanup failed');
      }
    } catch {
      toast.error('Failed to connect to cluster engine');
    }
  };

  return (
    <>
      <header className="bg-black/80 backdrop-blur-md border-b border-neutral-800 sticky top-0 z-20">
        <div className="px-3 sm:px-6 h-16 flex justify-between items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-colors cursor-pointer shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Vercel Breadcrumb */}
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-mono min-w-0">
              <Link to="/" className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                <span className="font-semibold text-neutral-200">ai-cloud</span>
              </Link>
              <span className="text-neutral-600">/</span>
              <span className="text-neutral-400 uppercase tracking-wider truncate">{currentPath}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Mobile Search Icon Button */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="sm:hidden p-2 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-colors cursor-pointer"
              title="Search (Cmd+K)"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Search bar with ⌘K trigger (Desktop/Tablet) */}
            <button 
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:flex items-center relative pl-8 pr-12 py-1.5 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-md text-xs text-neutral-400 w-44 md:w-56 transition-colors font-mono text-left cursor-pointer group"
            >
              <Search className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-300 absolute left-2.5 top-1/2 -translate-y-1/2 transition-colors" />
              <span className="text-neutral-500 group-hover:text-neutral-400 truncate">Search...</span>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-neutral-500 bg-neutral-900 border border-neutral-800 px-1 py-0.5 rounded">
                <Command className="w-2.5 h-2.5" />
                <span>K</span>
              </div>
            </button>

            {/* Notifications */}
            <button 
              onClick={() => toast.info('No new system alerts: Local cluster healthy.')}
              className="relative p-2 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-colors cursor-pointer"
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

      {/* Command Palette Modal (⌘K) */}
      {paletteOpen && (
        <div 
          onClick={() => setPaletteOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-20 p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0a0a0a] border border-neutral-800 rounded-xl w-full max-w-xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col text-white font-mono animate-in zoom-in-95 duration-100"
          >
            {/* Search Input Box */}
            <div className="p-3.5 border-b border-neutral-800 flex items-center gap-2.5 bg-black">
              <Search className="w-4 h-4 text-neutral-500 shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type a command, app, or jump to page..."
                className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-neutral-600 font-mono"
              />
              <button
                onClick={() => setPaletteOpen(false)}
                className="p-1 rounded text-neutral-500 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-4">
              {/* Navigation Items */}
              {filteredNav.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-neutral-500">
                    Navigation
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {filteredNav.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.path}
                          onClick={() => {
                            setPaletteOpen(false);
                            navigate(item.path);
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-neutral-900 text-left text-xs transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4 text-neutral-400 group-hover:text-white transition-colors" />
                            <div>
                              <p className="font-medium text-white">{item.label}</p>
                              <p className="text-[10px] text-neutral-500">{item.sub}</p>
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-neutral-600 group-hover:text-neutral-300 transition-colors" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Running Applications */}
              {filteredContainers.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-neutral-500">
                    Applications ({filteredContainers.length})
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {filteredContainers.slice(0, 5).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setPaletteOpen(false);
                          if (c.domain_name) {
                            window.open(`http://${c.domain_name}`, '_blank');
                          } else {
                            navigate('/');
                          }
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-neutral-900 text-left text-xs transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{c.clean_name || c.name}</p>
                            <p className="text-[10px] text-neutral-500 truncate">{c.domain_name || c.id}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-neutral-500 group-hover:text-white transition-colors shrink-0">
                          Open ↗
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div>
                <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-neutral-500">
                  Quick Actions
                </div>
                <div className="space-y-0.5 mt-1">
                  <button
                    onClick={handlePruneSystem}
                    className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-neutral-900 text-left text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-neutral-400" />
                    <span>Prune Unused Docker Images</span>
                  </button>
                  <button
                    onClick={() => {
                      setPaletteOpen(false);
                      window.location.reload();
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-neutral-900 text-left text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 text-neutral-400" />
                    <span>Refresh Dashboard Data</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-2.5 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between text-[10px] text-neutral-500">
              <span>Use arrow keys to navigate</span>
              <span>ESC to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
