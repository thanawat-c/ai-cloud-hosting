import { useState, useEffect } from 'react';
import { Webhook, X, Plus, Trash2, Send, Power, CheckCircle2, AlertTriangle, ExternalLink, HelpCircle, Sparkles, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '../../context/WorkspaceContext';

export const WebhooksModal = ({ isOpen, onClose }) => {
  const { activeWorkspaceId, currentWorkspace } = useWorkspace();
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('discord');
  const [events, setEvents] = useState('all');
  const [submitting, setSubmitting] = useState(false);

  const fetchWebhooks = async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8080/api/alerts/webhooks?workspace_id=${activeWorkspaceId}`, {
        headers: { 'X-Workspace-Id': activeWorkspaceId }
      });
      if (res.ok) {
        const data = await res.json();
        setWebhooks(Array.isArray(data) ? data : []);
      }
    } catch {
      toast.error('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWebhooks();
      setShowAddForm(false);
    }
  }, [isOpen, activeWorkspaceId]);

  if (!isOpen) return null;

  const handleCreateWebhook = async (e) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
      toast.error('Please enter webhook name and URL');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`http://localhost:8080/api/alerts/webhooks?workspace_id=${activeWorkspaceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-Id': activeWorkspaceId
        },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          platform,
          events
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create webhook');
      }

      toast.success(`Webhook "${data.name}" added successfully!`);
      setName('');
      setUrl('');
      setShowAddForm(false);
      fetchWebhooks();
    } catch (err) {
      toast.error(err.message || 'Error creating webhook');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      const res = await fetch(`http://localhost:8080/api/alerts/webhooks/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'X-Workspace-Id': activeWorkspaceId }
      });
      if (res.ok) {
        toast.success('Webhook status updated');
        fetchWebhooks();
      }
    } catch {
      toast.error('Failed to toggle webhook');
    }
  };

  const handleDelete = async (id, whName) => {
    if (!confirm(`Are you sure you want to delete "${whName}"?`)) return;
    try {
      const res = await fetch(`http://localhost:8080/api/alerts/webhooks/${id}`, {
        method: 'DELETE',
        headers: { 'X-Workspace-Id': activeWorkspaceId }
      });
      if (res.ok) {
        toast.success('Webhook removed');
        fetchWebhooks();
      }
    } catch {
      toast.error('Failed to delete webhook');
    }
  };

  const handleTest = async (id, whPlatform) => {
    setTestingId(id);
    try {
      const res = await fetch(`http://localhost:8080/api/alerts/webhooks/${id}/test`, {
        method: 'POST',
        headers: { 'X-Workspace-Id': activeWorkspaceId }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`🎉 Test notification delivered to ${whPlatform.toUpperCase()}! Check your channel.`);
      } else {
        toast.error(data.error || 'Failed to send test alert');
      }
    } catch (err) {
      toast.error('Network error testing webhook');
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Webhook className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-medium text-white tracking-tight">Outgoing Webhook Alerts</h3>
                <span className="px-2 py-0.5 text-[11px] font-mono rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                  {currentWorkspace?.name || 'Workspace'}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Receive real-time notifications in Discord, Slack, or any custom endpoint
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Bar / Toggle Guide */}
        <div className="px-6 py-3 bg-neutral-900/20 border-b border-neutral-800/80 flex items-center justify-between">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
            <span>How to get Discord / Slack Webhook URL?</span>
          </button>

          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:bg-neutral-200 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Webhook
            </button>
          )}
        </div>

        {/* Collapsible Guide */}
        {showGuide && (
          <div className="px-6 py-3.5 bg-purple-950/20 border-b border-purple-900/30 text-xs text-neutral-300 space-y-2 animate-fade-in">
            <div className="font-semibold text-purple-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Setting up Discord Webhook in 3 steps:
            </div>
            <ol className="list-decimal list-inside space-y-1 text-neutral-400 pl-1 text-[11px]">
              <li>In your Discord server, right-click your channel and choose <b>Edit Channel</b> &gt; <b>Integrations</b>.</li>
              <li>Click <b>Webhooks</b> &gt; <b>New Webhook</b> and give it a name (e.g. <i>AI Cloud Hosting</i>).</li>
              <li>Click <b>Copy Webhook URL</b>, paste it in the form below, and click <b>Add Webhook</b>!</li>
            </ol>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Add Webhook Form */}
          {showAddForm && (
            <form onSubmit={handleCreateWebhook} className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/50 space-y-3.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white tracking-wide uppercase">New Webhook Alert</span>
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)}
                  className="text-neutral-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">Webhook Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Discord #deploy-alerts"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">Target Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="discord">Discord (Rich Embeds with Status Colors)</option>
                    <option value="slack">Slack (Formatted Blocks)</option>
                    <option value="generic">Generic JSON Webhook (Custom Server)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">Webhook URL</label>
                <input
                  type="url"
                  required
                  placeholder={
                    platform === 'discord'
                      ? 'https://discord.com/api/webhooks/...'
                      : platform === 'slack'
                      ? 'https://hooks.slack.com/services/...'
                      : 'https://api.yourdomain.com/webhook'
                  }
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">Notification Events</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'all', label: 'All Events' },
                    { id: 'deploy', label: 'Deployments' },
                    { id: 'database', label: 'Databases' },
                    { id: 'system', label: 'Errors Only' },
                  ].map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => setEvents(ev.id)}
                      className={`px-2.5 py-1.5 text-[11px] rounded-lg border text-left transition-colors ${
                        events === ev.id
                          ? 'bg-purple-500/20 border-purple-500/40 text-purple-200'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      {ev.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Save Webhook'}
                </button>
              </div>
            </form>
          )}

          {/* Webhook List */}
          {loading ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              Loading active webhooks...
            </div>
          ) : webhooks.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-neutral-800 rounded-xl">
              <Webhook className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
              <p className="text-xs text-neutral-400 font-medium">No webhooks configured yet</p>
              <p className="text-[11px] text-neutral-600 mt-1 max-w-sm mx-auto">
                Add a Discord or Slack Webhook to receive instant deployment results, error warnings, and database snapshots directly in your chat.
              </p>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs transition-colors"
                >
                  + Add Your First Webhook
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((wh) => (
                <div
                  key={wh.id}
                  className={`p-4 rounded-xl border transition-all ${
                    wh.is_active 
                      ? 'bg-neutral-900/30 border-neutral-800 hover:border-neutral-700'
                      : 'bg-neutral-950/60 border-neutral-900 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white truncate">{wh.name}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full uppercase tracking-wider ${
                          wh.platform === 'discord'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            : wh.platform === 'slack'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                        }`}>
                          {wh.platform}
                        </span>
                        {wh.is_active ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-500">Disabled</span>
                        )}
                      </div>

                      <div className="text-[11px] font-mono text-neutral-500 truncate max-w-md">
                        {wh.url.replace(/(https:\/\/.*?\/webhooks\/[0-9]+\/)(.*)/, '$1••••••••')}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-neutral-500 pt-1">
                        <span>Triggers: <b className="text-neutral-400">{wh.events || 'all'}</b></span>
                        <span>•</span>
                        <span>Added: {new Date(wh.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleTest(wh.id, wh.platform)}
                        disabled={testingId === wh.id}
                        title="Send Test Message"
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Send className="w-3 h-3 text-purple-400" />
                        <span>{testingId === wh.id ? 'Testing...' : 'Test'}</span>
                      </button>

                      <button
                        onClick={() => handleToggle(wh.id)}
                        title={wh.is_active ? 'Disable' : 'Enable'}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          wh.is_active
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(wh.id, wh.name)}
                        title="Delete Webhook"
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-800/80 bg-neutral-900/30 flex items-center justify-between text-xs text-neutral-500">
          <span>Powered by Non-blocking Async Dispatcher</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
