import React from 'react';
import { Globe, X, Shield } from 'lucide-react';

export const CustomDomainModal = ({
  isOpen,
  onClose,
  domainContainer,
  customDomainInput,
  setCustomDomainInput,
  sslEnabledInput,
  setSslEnabledInput,
  sslForceRedirectInput,
  setSslForceRedirectInput,
  handleSaveCustomDomain,
  savingDomain,
}) => {
  if (!isOpen || !domainContainer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col text-white animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-black">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-blue-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white font-mono">Custom Domain Settings</h3>
              <p className="text-neutral-500 font-mono text-[11px] truncate max-w-xs">
                {domainContainer.name}
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

        {/* Body */}
        <div className="p-6 space-y-4 bg-[#0a0a0a]">
          <div>
            <label className="text-xs font-mono text-neutral-400 block mb-1.5">
              Default Internal Domain (Assigned by Traefik)
            </label>
            <input
              type="text"
              readOnly
              value={domainContainer.domain_name || 'Not assigned'}
              className="w-full bg-neutral-950 border border-neutral-800 text-neutral-400 px-3 py-2 rounded-md font-mono text-xs cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-neutral-200 block mb-1.5 flex items-center justify-between">
              <span>Custom Domain or Subdomain</span>
              <span className="text-[10px] text-neutral-500">e.g. api.yourdomain.com</span>
            </label>
            <input
              type="text"
              value={customDomainInput}
              onChange={(e) => setCustomDomainInput(e.target.value)}
              placeholder="api.mysite.com or myapp.localhost"
              className="w-full bg-black border border-neutral-700 text-white px-3 py-2 rounded-md font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Auto SSL & TLS Controls */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-semibold text-white">SSL / TLS Configuration</span>
              </div>
              {customDomainInput ? (
                customDomainInput.endsWith('.localhost') ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950/80 text-blue-400 border border-blue-800">
                    Local Dev SSL
                  </span>
                ) : sslEnabledInput ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                    Let's Encrypt Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-900 text-neutral-400 border border-neutral-800">
                    HTTP Only
                  </span>
                )
              ) : (
                <span className="text-[10px] font-mono text-neutral-500">No domain</span>
              )}
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="space-y-0.5">
                  <div className="text-xs font-mono text-neutral-300 group-hover:text-white transition-colors">
                    Enable Auto SSL (Let's Encrypt)
                  </div>
                  <div className="text-[10px] text-neutral-500 font-sans">
                    Auto-provisions TLS certificate via Traefik ACME challenge
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sslEnabledInput}
                  onChange={(e) => setSslEnabledInput(e.target.checked)}
                  className="w-4 h-4 rounded bg-neutral-900 border-neutral-700 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <div className="space-y-0.5">
                  <div className="text-xs font-mono text-neutral-300 group-hover:text-white transition-colors">
                    Force HTTPS (Auto 301 Redirect)
                  </div>
                  <div className="text-[10px] text-neutral-500 font-sans">
                    Automatically redirect all HTTP requests to HTTPS
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={sslForceRedirectInput}
                  onChange={(e) => setSslForceRedirectInput(e.target.checked)}
                  className="w-4 h-4 rounded bg-neutral-900 border-neutral-700 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* DNS Configuration Helper Note */}
          <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] font-mono text-neutral-400 space-y-1">
            <div className="flex items-center gap-1.5 text-neutral-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              <span>DNS & ACME Tip</span>
            </div>
            <p className="text-neutral-500 leading-relaxed">
              Point a <strong className="text-neutral-300">CNAME</strong> record to your host or an <strong className="text-neutral-300">A Record</strong> to your server public IP. Traefik will negotiate SSL certificates automatically.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md border border-neutral-800 hover:bg-neutral-900 text-neutral-400 text-xs font-mono transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveCustomDomain}
            disabled={savingDomain}
            className="px-4 py-1.5 rounded-md bg-white hover:bg-neutral-200 text-black text-xs font-semibold font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {savingDomain ? 'Saving...' : 'Save & Route'}
          </button>
        </div>
      </div>
    </div>
  );
};
