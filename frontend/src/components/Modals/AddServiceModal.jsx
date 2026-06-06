import { useState, useEffect } from 'react';
import { validateServiceForm } from '../../utils/validators.js';
import { getRemainingVram } from '../../utils/gpuHelpers.js';

/**
 * AddServiceModal — Modal dialog for adding a new service to a GPU server.
 *
 * Props:
 *   pcId            — Server ID to attach the service to
 *   pcGpus          — Array of GPU objects [{ name: string, vram: number }] on the target server
 *   pcServices      — Existing services array on that server (for per-GPU capacity checks)
 *   onSave          — (data: { pcId: string, nombre: string, puerto: number, gpu: number, assignedGpu: number }) => void
 *   onClose         — () => void
 *   loading         — Boolean indicating whether the API mutation is in-flight
 *   error           — String error message from the API (null when clear)
 *   clearError      — () => void callback to reset the error state
 */
export default function AddServiceModal({ pcId, pcGpus, pcServices, onSave, onClose, loading = false, error = null, clearError }) {
  const [formData, setFormData] = useState({ nombre: '', puerto: '', gpu: '', assignedGpu: '0' });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({ nombre: false, puerto: false, gpu: false, assignedGpu: false });

  /* ── Escape key handler ─────────────────────────────────────── */
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  /* ── Clear stale API errors when modal opens ────────────── */
  useEffect(() => {
    if (clearError) clearError();
  }, [clearError]);

  /* ── Inline live validation on each field change ─────────────── */
  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => {
      const updatedData = { ...prev, [id]: value };
      /* Base field-level validation with per-GPU capacity check */
      const { errors: allErrors } = validateServiceForm(updatedData, pcServices, pcGpus);
      setErrors(allErrors);
      return updatedData;
    });
    setTouched((prev) => ({ ...prev, [id]: true }));
  };

  /* ── Final validation on submit ─────────────────────────────── */
  const handleSubmit = (e) => {
    e.preventDefault();

    /* Mark every field as touched so all errors surface */
    const allTouched = { nombre: true, puerto: true, gpu: true, assignedGpu: true };
    setTouched(allTouched);

    const finalResult = validateServiceForm(formData, pcServices, pcGpus);
    setErrors(finalResult.errors);

    if (!finalResult.valid) return;

    /* Sanitise and dispatch upward — include pcId for routing */
    onSave({
      pcId:        pcId,
      nombre:      formData.nombre.trim(),
      puerto:      Number(formData.puerto),
      gpu:         Number(formData.gpu),
      assignedGpu: Number(formData.assignedGpu),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/82 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add new service"
        className="bg-bg-card rounded-lg border border-border shadow-[0_16px_64px_rgba(0,0,0,0.55)_0_4px_16px_rgba(0,0,0,0.3)] animate-dialog-fade w-full max-w-none md:max-w-[420px] h-screen md:h-auto p-5 md:p-6 lg:p-8 rounded-none md:rounded-lg m-0 md:m-4"
      >
        <h2 className="text-xl font-bold text-text-primary mb-6">Add New Service</h2>

        {/* ── Nombre ──────────────────────────────────────────── */}
        <div className="mb-4">
          <label className="block text-xs font-mono uppercase tracking-wide text-text-muted mb-2" htmlFor="nombre">
            Name
          </label>
          <input
            id="nombre"
            type="text"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="e.g. stable-diffusion-webui"
            aria-invalid={!!errors.nombre && touched.nombre}
            aria-describedby={errors.nombre && touched.nombre ? 'nombre-error' : undefined}
            className="w-full bg-bg-input border border-border rounded-sm px-3.5 py-2.5 font-mono text-base text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted"
          />
          {errors.nombre && touched.nombre && (
            <p id="nombre-error" className="mt-1 text-sm text-danger">{errors.nombre}</p>
          )}
        </div>

        {/* ── Puerto ─────────────────────────────────────────── */}
        <div className="mb-4">
          <label className="block text-xs font-mono uppercase tracking-wide text-text-muted mb-2" htmlFor="puerto">
            Port
          </label>
          <input
            id="puerto"
            type="number"
            min="1"
            max="65535"
            value={formData.puerto}
            onChange={handleChange}
            placeholder="e.g. 7860"
            aria-invalid={!!errors.puerto && touched.puerto}
            aria-describedby={errors.puerto && touched.puerto ? 'puerto-error' : undefined}
            className="w-full bg-bg-input border border-border rounded-sm px-3.5 py-2.5 font-mono text-base text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted"
          />
          {errors.puerto && touched.puerto && (
            <p id="puerto-error" className="mt-1 text-sm text-danger">{errors.puerto}</p>
          )}
        </div>

        {/* ── Assign to GPU Section ─────────────────────────────── */}
        <div className="mb-4">
          <label htmlFor="assignedGpu" className="block text-xs font-mono uppercase tracking-wide text-text-muted mb-1.5">
            Assign to GPU
          </label>
          {pcGpus.length === 0 ? (
            <p className="text-sm text-text-muted italic">No GPUs available on this server.</p>
          ) : (
            <>
              <select
                id="assignedGpu"
                value={formData.assignedGpu}
                onChange={handleChange}
                aria-invalid={!!errors.assignedGpu && touched.assignedGpu}
                aria-describedby={errors.assignedGpu && touched.assignedGpu ? 'assignedGpu-error' : undefined}
                className="bg-bg-input border border-border rounded-sm px-3.5 py-2.5 text-base font-mono text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim"
              >
                {pcGpus.map((gpu, idx) => {
                  const remain = getRemainingVram(pcGpus, pcServices, idx);
                  return (
                    <option key={idx} value={String(idx)}>
                      {gpu.name || `GPU ${idx + 1}`} — {remain} GB free
                    </option>
                  );
                })}
              </select>
              {errors.assignedGpu && touched.assignedGpu && (
                <p id="assignedGpu-error" className="mt-2 text-sm text-danger">
                  {errors.assignedGpu}
                </p>
              )}
            </>
          )}
        </div>

        {/* ── GPU ─────────────────────────────────────────────── */}
        <div className="mb-4">
          <label className="block text-xs font-mono uppercase tracking-wide text-text-muted mb-2" htmlFor="gpu">
            GPU VRAM (GB)
          </label>
          <input
            id="gpu"
            type="number"
            min="0"
            value={formData.gpu}
            onChange={handleChange}
            placeholder="e.g. 12"
            aria-invalid={!!errors.gpu && touched.gpu}
            aria-describedby={errors.gpu && touched.gpu ? 'gpu-error' : 'gpu-hint'}
            className="w-full bg-bg-input border border-border rounded-sm px-3.5 py-2.5 font-mono text-base text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted"
          />
          {errors.gpu && touched.gpu ? (
            <p id="gpu-error" className="mt-1 text-sm text-danger">{errors.gpu}</p>
          ) : (
            (() => {
              const selectedIdx = Number(formData.assignedGpu);
              if (!isNaN(selectedIdx) && Array.isArray(pcGpus) && selectedIdx >= 0 && selectedIdx < pcGpus.length) {
                const gpuRemain = getRemainingVram(pcGpus, pcServices, selectedIdx);
                return (
                  <p id="gpu-hint" className="mt-1 text-xs text-text-muted">
                    {gpuRemain} GB remaining on {pcGpus[selectedIdx].name || `GPU ${selectedIdx + 1}`}
                  </p>
                );
              }
              return null;
            })()
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
            onClick={onClose}
            className="flex-1 border border-border text-text-secondary px-4 py-2.5 rounded-md hover:bg-bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-accent text-bg-primary font-semibold px-4 py-2.5 rounded-md shadow-btn-primary hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            {loading ? 'Adding...' : 'Add Service'}
          </button>
        </div>
      </form>
    </div>
  );
}
