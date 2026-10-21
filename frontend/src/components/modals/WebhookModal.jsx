import React from 'react';
import { Webhook, X, Check, Copy, ExternalLink } from 'lucide-react';

export const WebhookModal = ({
  isOpen,
  onClose,
  activeWebhookContainer,
  getShortAppName,
  customPublicUrl,
  handleCopyUrl,
  copiedKey,
  handleUpdatePublicUrl,
  handleTestWebhookPing,
  pingingWebhook,
}) => {
  if (!isOpen || !activeWebhookContainer) return null;

  const urlToCopy = customPublicUrl.trim() 
    ? `${customPublicUrl.trim().replace(/\/$/, '')}/api/webhooks/deploy/${activeWebhookContainer.deployment_id}`
    : activeWebhookContainer.webhook_url;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col text-white">
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-neutral-900 text-purple-400 border border-neutral-800">
              <Webhook className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white tracking-tight">Webhook Auto-Deploy</h3>
              <span className="px-2 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-400 font-mono text-[11px] font-medium">
                {getShortAppName(activeWebhookContainer.name, activeWebhookContainer.clean_name)}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-900 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Step 1: Payload URL */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-300 mb-1.5">
              <span>1. Payload URL:</span>
              <button
                type="button"
                onClick={() => handleCopyUrl(urlToCopy, `wh-url-${activeWebhookContainer.deployment_id}`)}
                className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 font-medium cursor-pointer"
              >
                {copiedKey === `wh-url-${activeWebhookContainer.deployment_id}` ? (
                  <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
                ) : (
                  <><Copy className="w-3.5 h-3.5" /> Copy URL</>
                )}
              </button>
            </div>
            <div className="p-2.5 rounded-md bg-black text-neutral-200 font-mono text-xs select-all border border-neutral-800 break-all">
              {urlToCopy}
            </div>

            {/* Localhost Tunnel Helper */}
            <div className="mt-2.5 p-3 rounded-md bg-neutral-950 border border-neutral-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-400 font-medium">Public Tunnel Command (for Localhost):</span>
                <button
                  type="button"
                  onClick={() => handleCopyUrl('npx localtunnel --port 8080', 'cmd-localtunnel')}
                  className="text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'cmd-localtunnel' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  Copy Command
                </button>
              </div>
              <div className="p-2 bg-black rounded-md border border-neutral-800 font-mono text-[11px] text-neutral-300">
                <code>npx localtunnel --port 8080</code>
              </div>
              <input
                type="text"
                value={customPublicUrl}
                onChange={(e) => handleUpdatePublicUrl(e.target.value)}
                placeholder="Paste your Public URL, e.g. https://xxxx.loca.lt"
                className="w-full px-3 py-1.5 rounded-md border border-neutral-800 bg-black text-xs font-mono text-neutral-200 focus:outline-none focus:border-neutral-600"
              />
            </div>
          </div>

          {/* Step 2 & 3 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-xs font-semibold text-neutral-300 mb-1.5">2. Content type:</span>
              <div className="p-2.5 rounded-md bg-black text-neutral-300 font-mono text-xs border border-neutral-800">
                application/json
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-300 mb-1.5">
                <span>3. Secret:</span>
                <button
                  type="button"
                  onClick={() => handleCopyUrl(activeWebhookContainer.webhook_secret, `wh-sec-${activeWebhookContainer.deployment_id}`)}
                  className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 font-medium cursor-pointer"
                >
                  {copiedKey === `wh-sec-${activeWebhookContainer.deployment_id}` ? (
                    <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" /> Copy</>
                  )}
                </button>
              </div>
              <div className="p-2.5 rounded-md bg-black text-neutral-300 font-mono text-xs truncate border border-neutral-800">
                {activeWebhookContainer.webhook_secret}
              </div>
            </div>
          </div>

          {/* Step 4: Event */}
          <div className="p-2.5 rounded-lg bg-black border border-neutral-800 text-xs text-neutral-400 flex items-center justify-between">
            <span className="font-medium text-neutral-300">4. Event:</span>
            <span className="font-semibold text-purple-400">Just the push event</span>
          </div>

          {/* GitHub Link Guide */}
          {activeWebhookContainer.clean_name?.startsWith('http') && (
            <div className="text-right">
              <a
                href={`${activeWebhookContainer.clean_name.replace(/\.git$/, '')}/settings/hooks`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-medium hover:underline"
              >
                <span>Open GitHub Webhook Settings</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleTestWebhookPing}
            disabled={pingingWebhook}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-md text-xs font-mono border border-neutral-800 transition-colors cursor-pointer"
          >
            {pingingWebhook ? (
              <>
                <div className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Testing...</span>
              </>
            ) : (
              <>
                <Webhook className="w-3.5 h-3.5" />
                <span>Send Test Ping</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 rounded-md text-xs font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
