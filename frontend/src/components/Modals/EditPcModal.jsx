import { useState, useEffect } from 'react';
import { validatePcForm } from '../../utils/validators.js';

/**
 * EditPcModal — Modal dialog for editing an existing GPU server.
 *
 * Identical layout to AddPcModal but pre-fills form fields from the `pc` prop.
 * Pre-fills gpus[] from pc.gpus or falls back to scalar pc.vram for legacy data.
 * The submitted payload includes `_id` so the parent can route through updatePc().
 *
 * Props:
 *   pc      — Existing PC document { _id, nombre, ip, gpus?, vram?, servicios[] }
 *   onSave  — (data: { _id: string, nombre: string, ip: string, gpus: Array<{name:string,vram:number}> }) => void
 *   onClose — () => void
 */
export default function EditPcModal({ pc, onSave, onClose, loading = false, error = null, clearError }) {
  /* ── Lazy-initialize form data from the incoming PC object ──── */
  /* Uses a lazy initializer so the fallback logic runs once on mount.       */
  const [formData, setFormData] = useState(() => {
    let initialGpus;
    if (Array.isArray(pc?.gpus) && pc.gpus.length > 0) {
      initialGpus = pc.gpus.map((gpu, idx) => ({
        name: gpu.name ?? `GPU ${idx + 1}`,
        vram: String(gpu.vram ?? ''),
      }));
    } else if (pc?.vram != null && pc.vram !== '') {
      initialGpus = [{ name: 'GPU 1', vram: String(pc.vram) }];
    } else {
      initialGpus = [{ name: 'GPU 1', vram: '' }];
    }

    return {
      nombre: pc?.nombre ?? '',
      ip:     pc?.ip     ?? '',
      gpus:   initialGpus,
    };
  });

  const [errors, setErrors] = useState({});
  /* Touch gates start false — same as AddPcModal (no pre-blur) */
  const [touched, setTouched] = useState({
    nombre: false,
    ip:     false,
    gpus:   false,
  });

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

  /* ── Inline live validation on each scalar field change ───────── */
  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => {
      const updatedData = { ...prev, [id]: value };
      /* Live validation: re-validate the whole form with new value */
      const { errors: allErrors } = validatePcForm(updatedData);
      setErrors(allErrors);
      return updatedData;
    });
    setTouched((prev) => ({ ...prev, [id]: true }));
  };

  /* ── GPU list helpers ────────────────────────────────────────── */
  const handleGpuFieldChange = (idx, field, value) => {
    setFormData((prev) => {
      const updatedGpus = [...prev.gpus];
      updatedGpus[idx] = { ...updatedGpus[idx], [field]: value };
      const updatedData = { ...prev, gpus: updatedGpus };
      const { errors: allErrors } = validatePcForm(updatedData);
      setErrors(allErrors);
      return updatedData;
    });
    setTouched((prev) => ({ ...prev, gpus: true }));
  };

  const handleAddGpu = () => {
    setFormData((prev) => ({
      ...prev,
      gpus: [
        ...prev.gpus,
        { name: `GPU ${prev.gpus.length + 1}`, vram: '' },
      ],
    }));
    setTouched((prev) => ({ ...prev, gpus: true }));
  };

  const handleRemoveGpu = (idx) => {
    setFormData((prev) => {
      if (prev.gpus.length <= 1) return prev;
      const updatedGpus = prev.gpus.filter((_, i) => i !== idx);
      const updatedData = { ...prev, gpus: updatedGpus };
      const { errors: allErrors } = validatePcForm(updatedData);
      setErrors(allErrors);
      return updatedData;
    });
  };

  /* ── Final validation on submit ─────────────────────────────── */
  const handleSubmit = (e) => {
    e.preventDefault();

    /* Mark every field as touched so all errors surface */
    const allTouched = { nombre: true, ip: true, gpus: true };
    setTouched(allTouched);

    const { valid, errors: finalErrors } = validatePcForm(formData);
    setErrors(finalErrors);

    if (!valid) return;

    /* Sanitise and dispatch upward — include _id for PUT routing */
    onSave({
      _id:    pc?._id,
      nombre: formData.nombre.trim(),
      ip:     formData.ip.trim(),
      gpus:   formData.gpus.map((gpu, idx) => ({
        name: gpu.name || `GPU ${idx + 1}`,
        vram: Number(gpu.vram),
      })),
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
        aria-label="Edit server"
        className="bg-bg-card rounded-lg border border-border shadow-[0_16px_64px_rgba(0,0,0,0.55)_0_4px_16px_rgba(0,0,0,0.3)] animate-dialog-fade w-full max-w-none md:max-w-[420px] h-screen md:h-auto p-5 md:p-6 lg:p-8 rounded-none md:rounded-lg m-0 md:m-4"
      >
        <h2 className="text-xl font-bold text-text-primary mb-6">Edit Server</h2>

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
            placeholder="e.g. render-node-01"
            aria-invalid={!!errors.nombre && touched.nombre}
            aria-describedby={errors.nombre && touched.nombre ? 'nombre-error' : undefined}
            className="w-full bg-bg-input border border-border rounded-sm px-3.5 py-2.5 font-mono text-base text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted"
          />
          {errors.nombre && touched.nombre && (
            <p id="nombre-error" className="mt-1 text-sm text-danger">{errors.nombre}</p>
          )}
        </div>

        {/* ── IP ──────────────────────────────────────────────── */}
        <div className="mb-4">
          <label className="block text-xs font-mono uppercase tracking-wide text-text-muted mb-2" htmlFor="ip">
            IP Address
          </label>
          <input
            id="ip"
            type="text"
            value={formData.ip}
            onChange={handleChange}
            placeholder="e.g. 192.168.1.100"
            aria-invalid={!!errors.ip && touched.ip}
            aria-describedby={errors.ip && touched.ip ? 'ip-error' : undefined}
            className="w-full bg-bg-input border border-border rounded-sm px-3.5 py-2.5 font-mono text-base text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted"
          />
          {errors.ip && touched.ip && (
            <p id="ip-error" className="mt-1 text-sm text-danger">{errors.ip}</p>
          )}
        </div>

        {/* ── GPUs Section ─────────────────────────────────────── */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="block text-xs font-mono uppercase tracking-wide text-text-muted">
              GPUs
            </span>
            <button
              type="button"
              onClick={handleAddGpu}
              className="text-xs text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
              aria-label="Add another GPU"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add GPU
            </button>
          </div>

          {errors.gpus && touched.gpus && (
            <p id="gpus-error" className="mb-2 text-sm text-danger">{errors.gpus}</p>
          )}

          {formData.gpus.map((gpu, idx) => (
            <div key={idx}>
              <div className="grid grid-cols-[1fr_auto] gap-4 mb-1 items-center">
                <input
                  id={`gpu-name-${idx}`}
                  type="text"
                  value={gpu.name}
                  onChange={(e) => handleGpuFieldChange(idx, 'name', e.target.value)}
                  placeholder={`GPU ${idx + 1}`}
                  aria-invalid={!!errors[`gpus[${idx}]`] && touched.gpus}
                  className="bg-bg-input border border-border rounded-sm px-3.5 py-2 text-base font-mono text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted"
                />
                <div className="flex gap-2 items-center">
                  <input
                    id={`gpu-vram-${idx}`}
                    type="number"
                    min="1"
                    value={gpu.vram}
                    onChange={(e) => handleGpuFieldChange(idx, 'vram', e.target.value)}
                    placeholder="GB"
                    aria-invalid={!!errors[`gpus[${idx}]`] && touched.gpus}
                    className="w-20 bg-bg-input border border-border rounded-sm px-3 py-2 text-base font-mono text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveGpu(idx)}
                    disabled={formData.gpus.length <= 1}
                    aria-label={`Remove ${gpu.name || 'GPU'} from list`}
                    className="text-danger/60 hover:text-danger transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
              {errors[`gpus[${idx}]`] && touched.gpus && (
                <p className="text-xs text-danger mt-1">{errors[`gpus[${idx}]`]}</p>
              )}
            </div>
          ))}
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
            {loading ? 'Saving...' : 'Update Server'}
          </button>
        </div>
      </form>
    </div>
  );
}
