import { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Rocket, X, Database, Plus, Check, ChevronsUpDown, Users, LogOut, Key, Copy, Trash2, Code, Sparkles, History, Webhook } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { TeamMembersModal, AuditLogModal, WebhooksModal } from './modals';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const { workspaces, activeWorkspaceId, currentWorkspace, switchWorkspace } = useWorkspace();

  // Modals State
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [newTokenName, setNewTokenName] = useState('');
  const [generatedToken, setGeneratedToken] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8080/api/tokens', {
        headers: { 'X-Workspace-Id': activeWorkspaceId },
      });
      if (res.ok) {
        const data = await res.json();
        setTokens(data || []);
      }
    } catch (err) {
      void err;
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (tokenModalOpen) {
      const timer = setTimeout(() => {
        fetchTokens();
        setGeneratedToken(null);
        setCopiedToken(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [tokenModalOpen, fetchTokens]);

  const handleCreateToken = async (e) => {
    e.preventDefault();
    if (!newTokenName.trim()) {
      toast.warning('Please enter a token name');
      return;
    }
    setTokenLoading(true);
    try {
      const res = await fetch('http://localhost:8080/api/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-Id': activeWorkspaceId,
        },
        body: JSON.stringify({ name: newTokenName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedToken(data.token);
        setNewTokenName('');
        fetchTokens();
        toast.success('API Token generated successfully!');
        window.dispatchEvent(new CustomEvent('notification-refresh'));
      } else {
        toast.error(data.error || 'Failed to generate token');
      }
    } catch {
      toast.error('Network error creating token');
    } finally {
      setTokenLoading(false);
    }
  };

  const handleRevokeToken = async (id) => {
    try {
      const res = await fetch(`http://localhost:8080/api/tokens/${id}`, {
        method: 'DELETE',
        headers: { 'X-Workspace-Id': activeWorkspaceId },
      });
      if (res.ok) {
        toast.success('Token revoked');
        fetchTokens();
        window.dispatchEvent(new CustomEvent('notification-refresh'));
      } else {
        toast.error('Failed to revoke token');
      }
    } catch (err) {
      void err;
    }
  };

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
                  setTeamModalOpen(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-neutral-900 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-purple-400" />
                <span>Team Members</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setWorkspaceMenuOpen(false);
                  setAuditModalOpen(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-neutral-900 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-blue-400" />
                <span>Audit Log</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setWorkspaceMenuOpen(false);
                  setWebhookModalOpen(true);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-neutral-900 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <Webhook className="w-3.5 h-3.5 text-indigo-400" />
                <span>Webhook Alerts</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setWorkspaceMenuOpen(false);
                  setTokenModalOpen(true);
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
                  logout();
                  navigate('/login');
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

      {/* API Tokens Management Modal */}
      {tokenModalOpen && (
        <div 
          onClick={() => setTokenModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-[#0a0a0a] border border-neutral-800 rounded-xl shadow-2xl p-4 sm:p-6 text-white font-mono animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-emerald-400">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">API Tokens</h3>
                  <p className="text-[11px] text-neutral-400">Scoped to {currentWorkspace?.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTokenModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Generated Token Alert */}
            {generatedToken && (
              <div className="mt-4 p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    New Token Created
                  </span>
                  <span className="text-[10px] text-neutral-400">Copy now, won't show again</span>
                </div>
                <div className="flex items-center gap-2 bg-black/60 p-2 rounded border border-neutral-800 text-[11px] font-mono break-all text-neutral-200">
                  <span className="flex-1 select-all">{generatedToken}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedToken);
                      setCopiedToken(true);
                      toast.success('Token copied to clipboard!');
                      setTimeout(() => setCopiedToken(false), 2000);
                    }}
                    className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded transition-colors shrink-0 cursor-pointer"
                    title="Copy token"
                  >
                    {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Create New Token Form */}
            <form onSubmit={handleCreateToken} className="mt-4 space-y-3">
              <label className="block text-xs text-neutral-300 font-semibold">
                Generate New Token
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTokenName}
                  onChange={e => setNewTokenName(e.target.value)}
                  placeholder="e.g. GitHub Actions, CLI Script"
                  className="flex-1 bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors font-mono"
                />
                <button
                  type="submit"
                  disabled={tokenLoading || !newTokenName.trim()}
                  className="px-3.5 py-2 bg-white hover:bg-neutral-200 disabled:opacity-40 text-black font-semibold text-xs rounded-lg transition-colors shrink-0 cursor-pointer"
                >
                  {tokenLoading ? 'Creating...' : 'Generate'}
                </button>
              </div>
            </form>

            {/* Existing Tokens List */}
            <div className="mt-6">
              <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Active Tokens ({tokens.length})</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 scrollbar-thin">
                {tokens.length === 0 ? (
                  <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 text-center text-neutral-500 text-xs">
                    No API tokens yet. Generate one to authenticate automated scripts.
                  </div>
                ) : (
                  tokens.map(t => (
                    <div 
                      key={t.id}
                      className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">{t.name}</div>
                        <div className="text-[10px] text-neutral-500 font-mono flex items-center gap-2 mt-0.5">
                          <span>{t.masked_token}</span>
                          <span>•</span>
                          <span>{new Date(t.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevokeToken(t.id)}
                        className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors cursor-pointer shrink-0"
                        title="Revoke token"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Terminal Usage Hint */}
            <div className="mt-5 p-3 rounded-lg bg-neutral-950 border border-neutral-900 text-[10px] text-neutral-400">
              <div className="flex items-center gap-1.5 text-neutral-300 font-semibold mb-1">
                <Code className="w-3 h-3 text-neutral-400" />
                <span>Usage in cURL or CI/CD:</span>
              </div>
              <code className="text-neutral-400 block bg-black p-2 rounded border border-neutral-900 overflow-x-auto text-[10px]">
                curl -H "Authorization: Bearer &lt;TOKEN&gt;" -H "X-Workspace-Id: {activeWorkspaceId}" http://localhost:8080/api/containers
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Team Members & Permissions Modal */}
      <TeamMembersModal
        isOpen={teamModalOpen}
        onClose={() => setTeamModalOpen(false)}
      />

      {/* Audit Log Timeline Modal */}
      <AuditLogModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
      />

      {/* Outgoing Webhook Alerts Modal */}
      <WebhooksModal
        isOpen={webhookModalOpen}
        onClose={() => setWebhookModalOpen(false)}
      />
    </>
  );
};

export default Sidebar;
