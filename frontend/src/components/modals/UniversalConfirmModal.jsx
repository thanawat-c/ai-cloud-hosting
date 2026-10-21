import React from 'react';
import { AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';

export const UniversalConfirmModal = ({ confirmModal, onClose }) => {
  if (!confirmModal?.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-neutral-800 flex flex-col text-white p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3.5">
          <div className={`p-3 rounded-2xl shrink-0 ${
            confirmModal.variant === 'danger' 
              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
              : confirmModal.variant === 'warning'
              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              : 'bg-neutral-900 text-neutral-300 border border-neutral-800'
          }`}>
            {confirmModal.variant === 'danger' ? (
              <AlertTriangle className="w-6 h-6" />
            ) : confirmModal.variant === 'warning' ? (
              <AlertCircle className="w-6 h-6" />
            ) : (
              <RefreshCw className="w-6 h-6" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-white tracking-tight">{confirmModal.title}</h3>
            <p className="text-xs text-neutral-400 font-mono mt-1.5 leading-relaxed">{confirmModal.message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 rounded-md transition-colors cursor-pointer"
          >
            {confirmModal.cancelText || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => {
              const action = confirmModal.onConfirm;
              onClose();
              if (action) action();
            }}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md text-white transition-colors cursor-pointer flex items-center gap-1.5 ${
              confirmModal.variant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/30'
                : confirmModal.variant === 'warning'
                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-900/30'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/30'
            }`}
          >
            {confirmModal.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};
