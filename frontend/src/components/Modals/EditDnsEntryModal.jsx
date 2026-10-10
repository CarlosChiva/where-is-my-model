import { useState, useEffect } from 'react';
import { validateDnsEntryForm } from '../../utils/validators.js';

/**
 * EditDnsEntryModal — Modal dialog for editing an existing DNS entry.
 *
 * Pre-fills form fields from the `entry` prop.
 *
 * Props:
 *   entry         — DNS entry object
 *   onSave        — (data: { entryId, name, host, port?, probeDomain?, type }) => void
 *   onCancel      — () => void
 *   loading       — Boolean indicating whether the API mutation is in-flight
 *   error         — String error message from the API (null when clear)
 *   clearError    — () => void callback to reset the error state
 */
export default function EditDnsEntryModal({ entry, onSave, onCancel, loading = false, error = null, clearError }) {
  /* ── Pre-populate form data from the incoming entry object ─── */
  const [formData, setFormData] = useState({
    name:        entry?.name ?? '',
    host:        entry?.host ?? '',
    port:        String(entry?.port ?? ''),
    probeDomain: entry?.probeDomain ?? '',
    type:        entry?.type ?? 'A',
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({ name: false, host: false, port: false, probeDomain: false, type: false });

  /* ── Escape key handler ─────────────────────────────────────── */
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onCancel]);

  /* ── Clear stale API errors when modal opens ────────────── */
  useEffect(() => {
    if (clearError) clearError();
  }, [clearError]);

  /* ── Inline live validation on each field change ─────────────── */
  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => {
      const updatedData = { ...prev, [id]: value };
      const { errors: allErrors } = validateDnsEntryForm(updatedData, { mode: 'edit' });
      setErrors(allErrors);
      return updatedData;
    });
    setTouched((prev) => ({ ...prev, [id]: true }));
  };

  /* ── Final validation on submit ─────────────────────────────── */
  const handleSubmit = (e) => {
    e.preventDefault();

    /* Mark every field as touched so all errors surface */
    const allTouched = { name: true, host: true, port: true, probeDomain: true, type: true };
    setTouched(allTouched);

    const finalResult = validateDnsEntryForm(formData, { mode: 'edit' });
    setErrors(finalResult.errors);

    if (!finalResult.valid) return;

    /* Sanitise and dispatch upward — include entryId for routing */
    const payload = {
      entryId: entry._id,
      name:    formData.name.trim(),
      host:    formData.host.trim(),
      type:    formData.type,
    };
    if (formData.port !== '') {
      payload.port = Number(formData.port);
    }
    if (formData.probeDomain !== '') {
      payload.probeDomain = formData.probeDomain.trim();
    }
    onSave(payload);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/82 backdrop-blur-sm"
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Edit DNS entry"
        className="bg-bg-card rounded-lg border border-border shadow-dialog animate-dialog-fade w-full max-w-none md:max-w-[420px] h-screen md:h-auto p-5 md:p-6 lg:p-8 rounded-none md:rounded-lg m-0 md:m-4"
      >
        <h2 className="text-xl font-bold text-text-primary mb-6">Edit DNS Entry</h2>

        {/* ── Name ──────────────────────────────────────────── */}
        <div className="mb-4">
          <label className="block text-xs font-mono uppercase tracking-wide text-text-muted mb-2" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. google-dns"
            aria-invalid={!!errors.name && touched.name}
            aria-describedby={errors.name && touched.name ? 'name-error' : undefined}
            className="w-full bg-bg-input border border-border rounded-sm px-3.5 py-2.5 font-mono text-base text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted"
          />
          {errors.name && touched.name && (
            <p id="name-error" className="mt-1 text-sm text-danger">{errors.name}</p>
          )}
        </div>

        {/* ── Host ─────────────────────────────────────────── */}
        <div className="mb-4">
          <label className="block text-xs font-mono uppercase tracking-wide text-text-muted mb-2" htmlFor="host">
            Host
          </label>
          <input
            id="host"
            type="text"
            value={formData.host}
            onChange={handleChange}
            placeholder="e.g. 192.168.1.1"
            aria-invalid={!!errors.host && touched.host}
            aria-describedby={errors.host && touched.host ? 'host-error' : 'host-hint'}
            className="w-full bg-bg-input border border-border rounded-sm px-3.5 py-2.5 font-mono text-base text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted"
          />
          {errors.host && touched.host && (
            <p id="host-error" className="mt-1 text-sm text-danger">{errors.host}</p>
          )}
          <p id="host-hint" className="mt-1 text-xs text-text-muted">
            IPv4, IPv6 literal, or hostname (e.g. 192.168.1.1, 2001:db8::1, dns.example.com).
          </p>
        </div>

        {/* ── Port ─────────────────────────────────────────── */}
        <div className="mb-4">
          <label className="block text-xs font-mono uppercase tracking-wide text-text-muted mb-2" htmlFor="port">
            Port
          </label>
          <input
            id="port"
            type="number"
            min="1"
            max="65535"
            value={formData.port}
            onChange={handleChange}
            placeholder="e.g. 53"
            aria-invalid={!!errors.port && touched.port}
            aria-describedby={errors.port && touched.port ? 'port-error' : undefined}
            className="w-full bg-bg-input border border-border rounded-sm px-3.5 py-2.5 font-mono text-base text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted"
          />
          {errors.port && touched.port && (
            <p id="port-error" className="mt-1 text-sm text-danger">{errors.port}</p>
          )}
        </div>

        {/* ── Probe Domain ─────────────────────────────────── */}
        <div className="mb-4">
          <label className="block text-xs font-mono uppercase tracking-wide text-text-muted mb-2" htmlFor="probeDomain">
            Probe Domain
          </label>
          <input
            id="probeDomain"
            type="text"
            value={formData.probeDomain}
            onChange={handleChange}
            placeholder="e.g. example.com"
            aria-invalid={!!errors.probeDomain && touched.probeDomain}
            aria-describedby={errors.probeDomain && touched.probeDomain ? 'probeDomain-error' : undefined}
            className="w-full bg-bg-input border border-border rounded-sm px-3.5 py-2.5 font-mono text-base text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted"
          />
          {errors.probeDomain && touched.probeDomain && (
            <p id="probeDomain-error" className="mt-1 text-sm text-danger">{errors.probeDomain}</p>
          )}
        </div>

        {/* ── Type ─────────────────────────────────────────── */}
        <div className="mb-4">
          <label className="block text-xs font-mono uppercase tracking-wide text-text-muted mb-2" htmlFor="type">
            Type
          </label>
          <select
            id="type"
            value={formData.type}
            onChange={handleChange}
            aria-invalid={!!errors.type && touched.type}
            aria-describedby={errors.type && touched.type ? 'type-error' : undefined}
            className="bg-bg-input border border-border rounded-sm px-3.5 py-2.5 text-base font-mono text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim"
          >
            <option value="A">A</option>
            <option value="AAAA">AAAA</option>
          </select>
          {errors.type && touched.type && (
            <p id="type-error" className="mt-2 text-sm text-danger">{errors.type}</p>
          )}
        </div>

        {/* ── API Error ─────────────────────────────────── */}
        {error && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-md">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* ── Buttons ─────────────────────────────────────────── */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-border text-text-secondary px-4 py-2.5 rounded-md hover:bg-bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-btn-primary text-btn-primary-fg font-semibold px-4 py-2.5 rounded-md shadow-btn-primary hover:bg-btn-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            {loading ? 'Updating…' : 'Update Entry'}
          </button>
        </div>
      </form>
    </div>
  );
}
