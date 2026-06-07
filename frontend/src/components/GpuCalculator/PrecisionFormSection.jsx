import { Fragment } from 'react';

/**
 * PrecisionFormSection — Precision / quantization selects for the GPU Calculator.
 *
 * A controlled, stateless form section that renders two `<select>` dropdowns for
 * model dtype precision and KV cache dtype precision. Receives all values via a
 * `values` prop and communicates changes upward through an `onChange(fieldName, value)` callback.
 *
 * Props:
 *   values   — Object with current field values:
 *               { dtype_bytes, kv_cache_dtype_bytes }
 *   onChange — (fieldName: string, value: string) => void
 */
export default function PrecisionFormSection({ values = {}, onChange }) {
  const precisionOptions = [
    { label: 'float32 (4 bytes)', value: '4' },
    { label: 'bfloat16/float16 (2 bytes)', value: '2' },
    { label: 'float8 (1 byte)', value: '1' },
    { label: 'int4 (0.5 bytes)', value: '0.5' },
  ];

  const fields = [
    {
      id: 'dtype_bytes',
      label: 'Precision del modelo (dtype_bytes)',
      default: '2',
    },
    {
      id: 'kv_cache_dtype_bytes',
      label: 'Precision del KV cache (kv_cache_dtype_bytes)',
      default: '2',
    },
  ];

  /* ── Shared select class — mirrors modal field styling ── */
  const selectCls =
    'w-full bg-bg-input border border-border rounded-sm px-3.5 py-2.5 font-mono text-base text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim appearance-none';

  return (
    <Fragment>
      <section>
        <h2 className="text-lg font-bold text-text-primary mb-4">🔢 Precisión y cuantización</h2>

        {fields.map(({ id, label, default: defaultValue }) => {
          const value = values[id] ?? defaultValue;

          return (
            <div key={id} className="mb-4">
              <label
                htmlFor={id}
                className="block text-xs font-mono uppercase tracking-wide text-text-muted mb-1.5"
              >
                {label}
              </label>
              <select
                id={id}
                value={value}
                onChange={(e) => onChange(id, e.target.value)}
                className={selectCls}
              >
                {precisionOptions.map(({ label: optLabel, value: optValue }) => (
                  <option key={optValue} value={optValue}>
                    {optLabel}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </section>
    </Fragment>
  );
}
