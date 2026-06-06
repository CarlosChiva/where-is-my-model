import { useEffect } from 'react';

/**
 * DeleteConfirmModal — Confirmation dialog before destructive operations.
 *
 * Displays a dynamic warning message with Cancel (secondary) and
 * Delete (danger) action buttons. After onConfirm fires, the modal
 * closes itself so callers never need to wire a separate close call.
 *
 * Props:
 *   isOpen    — boolean controlling whether this dialog is visible
 *   message   — string rendered as the body text (e.g. "Delete server
 *               'render-node-01'? This action cannot be undone.")
 *   onConfirm — function invoked when user clicks Delete. Runs once,
 *               then the modal auto-closes itself.
 *   onCancel  — function invoked on Cancel click, backdrop click, or
 *               Escape key press.
 */
export default function DeleteConfirmModal({ isOpen, message, onConfirm, onCancel, loading = false, error = null }) {
  /* ── Escape key handler ─────────────────────────────────────── */
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onCancel]);

  /* ── Confirm: fire callback; parent controls close ──────────── */
  const handleConfirm = () => {
    onConfirm();
  };

  /* ── Conditional render — invisible when !isOpen ────────────── */
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/82 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Confirm delete"
        className="bg-bg-card rounded-lg border border-border shadow-[0_16px_64px_rgba(0,0,0,0.55)_0_4px_16px_rgba(0,0,0,0.3)] animate-dialog-fade w-full max-w-none md:max-w-[420px] h-screen md:h-auto p-5 md:p-6 lg:p-8 rounded-none md:rounded-lg m-0 md:m-4"
      >
        <h2 className="text-xl font-bold text-text-primary mb-6">Confirm Delete</h2>

        <p className="text-base text-text-secondary mb-6 leading-relaxed">{message}</p>

        {/* ── API Error ─────────────────────────────────── */}
        {error && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-md">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        <div className="flex gap-3 mt-6 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 border border-border text-text-secondary px-4 py-2.5 rounded-md hover:bg-bg-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 bg-danger text-white font-semibold px-4 py-2.5 rounded-md shadow-btn-danger hover:bg-danger-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && (
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
