import { useState, useEffect } from 'react';
import { Users, X, UserPlus, Shield, Trash2, Check, RefreshCw, Mail, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '../../context/WorkspaceContext';

export const TeamMembersModal = ({ isOpen, onClose }) => {
  const { activeWorkspaceId, currentWorkspace } = useWorkspace();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);

  // Invite Form State
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('member');

  const fetchMembers = async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8080/api/workspaces/members', {
        headers: { 'X-Workspace-Id': activeWorkspaceId },
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data || []);
      }
    } catch {
      toast.error('Failed to load workspace members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
      setEmail('');
      setName('');
      setRole('member');
    }
  }, [isOpen, activeWorkspaceId]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.warning('Please enter an email address');
      return;
    }

    setInviting(true);
    try {
      const res = await fetch('http://localhost:8080/api/workspaces/members/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-Id': activeWorkspaceId,
        },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          role: role,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to invite member');

      toast.success('Member invited successfully!');
      setEmail('');
      setName('');
      setRole('member');
      fetchMembers();
      window.dispatchEvent(new CustomEvent('notification-refresh'));
    } catch (err) {
      toast.error(err.message || 'Error inviting member');
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (memberId, newRole) => {
    try {
      const res = await fetch(`http://localhost:8080/api/workspaces/members/${memberId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-Id': activeWorkspaceId,
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update role');

      toast.success('Member role updated');
      fetchMembers();
      window.dispatchEvent(new CustomEvent('notification-refresh'));
    } catch (err) {
      toast.error(err.message || 'Error updating role');
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this workspace?`)) return;

    try {
      const res = await fetch(`http://localhost:8080/api/workspaces/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'X-Workspace-Id': activeWorkspaceId },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove member');

      toast.success('Member removed');
      fetchMembers();
      window.dispatchEvent(new CustomEvent('notification-refresh'));
    } catch (err) {
      toast.error(err.message || 'Error removing member');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-[#0a0a0a] border border-neutral-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-purple-400">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white font-mono truncate">
                  Team Members & Permissions
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30 font-mono">
                  {currentWorkspace?.name || activeWorkspaceId}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 font-mono truncate">
                Manage members, roles, and collaborate in this workspace
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs font-mono">
          {/* Invite Form */}
          <form onSubmit={handleInvite} className="p-4 rounded-lg bg-neutral-950 border border-neutral-800/80 space-y-3">
            <div className="flex items-center gap-2 text-neutral-300 font-semibold">
              <UserPlus className="w-4 h-4 text-purple-400" />
              <span>Invite New Member</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="collaborator@company.com"
                  required
                  className="w-full px-3 py-2 rounded-md bg-black border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name (optional)"
                  className="w-full px-3 py-2 rounded-md bg-black border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-md bg-black border border-neutral-800 text-white focus:outline-none focus:border-neutral-600 text-xs font-mono cursor-pointer"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full py-2 px-3 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {inviting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>Invite</span>
                </button>
              </div>
            </div>

            <div className="text-[10px] text-neutral-500 flex items-center gap-4 flex-wrap pt-0.5">
              <span><b>Admin</b>: Manage services, databases & settings</span>
              <span><b>Member</b>: Deploy & trigger builds</span>
              <span><b>Viewer</b>: Read-only access</span>
            </div>
          </form>

          {/* Members List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-neutral-400 px-1">
              <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">
                Workspace Members ({members.length})
              </span>
              <button
                type="button"
                onClick={fetchMembers}
                className="hover:text-white transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="border border-neutral-800 rounded-lg overflow-hidden divide-y divide-neutral-900 bg-black">
              {loading && members.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Loading team members...</span>
                </div>
              ) : members.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">
                  No members found in this workspace
                </div>
              ) : (
                members.map((m) => {
                  const isOwner = m.role === 'owner';
                  return (
                    <div key={m.id} className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-neutral-950 transition-colors">
                      {/* Avatar & Info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <img
                          src={m.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${m.email}`}
                          alt={m.name}
                          className="w-8 h-8 rounded-full border border-neutral-800 bg-neutral-900 shrink-0"
                          onError={(e) => {
                            e.target.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${m.email}`;
                          }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white font-medium truncate">{m.name}</span>
                            {isOwner && (
                              <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase font-semibold">
                                <Crown className="w-2.5 h-2.5" /> Owner
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-neutral-400 truncate block">{m.email}</span>
                        </div>
                      </div>

                      {/* Role Selector & Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isOwner ? (
                          <span className="text-neutral-500 text-xs px-2.5 py-1">Full Ownership</span>
                        ) : (
                          <>
                            <select
                              value={m.role}
                              onChange={(e) => handleUpdateRole(m.id, e.target.value)}
                              className="px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-mono focus:outline-none focus:border-neutral-600 cursor-pointer"
                            >
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleRemoveMember(m.id, m.name)}
                              className="p-1.5 rounded text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Remove member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-neutral-950/80 border-t border-neutral-800 shrink-0">
          <span className="text-[11px] text-neutral-500">
            Roles can be updated anytime by workspace admins.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-white hover:bg-neutral-200 text-black text-xs font-semibold font-mono transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
