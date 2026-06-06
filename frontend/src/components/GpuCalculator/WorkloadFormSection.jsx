/**
 * WorkloadFormSection — Workload parameter inputs for the GPU Calculator.
 *
 * A controlled, stateless form section that renders five number inputs for
 * workload and inferencing parameters (context length, concurrency, prompt
 * / output lengths, and prefix cache hit ratio). Receives all values via a
 * `values` prop and communicates changes upward through an
 * `onChange(fieldName, value)` callback.
 *
 * Props:
 *   values  — Object with current field values:
 *              { max_model_len, max_num_seqs, avg_prompt_len,
 *                avg_output_len, prefix_cache_hit_ratio }
 *   onChange— (fieldName: string, rawValue: string) => void
 */
export default function WorkloadFormSection({ values = {}, onChange }) {
  const fields = [
    {
      id: 'max_model_len',
      label: 'Max Model Length',
      hint: 'Maximum context/sequence length (e.g., 4096)',
      placeholder: '4096',
      default: 4096,
    },
    {
      id: 'max_num_seqs',
      label: 'Max Num Sequences',
      hint: 'Maximum concurrent requests / batch size (e.g., 256)',
      placeholder: '256',
      default: 256,
    },
    {
      id: 'avg_prompt_len',
      label: 'Avg Prompt Length',
      hint: 'Average input prompt token length (e.g., 256)',
      placeholder: '256',
      default: 256,
    },
    {
      id: 'avg_output_len',
      label: 'Avg Output Length',
      hint: 'Average generated output token length (e.g., 1024)',
      placeholder: '1024',
      default: 1024,
    },
    {
      id: 'prefix_cache_hit_ratio',
      label: 'Prefix Cache Hit Ratio',
      hint: 'Fraction of KV cache covered by shared prefix (0 = none, 1 = all)',
      placeholder: '0.5',
      default: 0.5,
    },
  ];

  /* ── Shared input class — mirrors modal field styling ── */
  const inputCls =
    'w-full bg-bg-input border border-border rounded-sm px-3.5 py-2.5 font-mono text-base text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted';

  return (
    <section>
      <h2 className="text-lg font-bold text-text-primary mb-4">🎯 Carga de trabajo</h2>

      {fields.map(({ id, label, hint, placeholder, default: defaultValue }) => {
        const value = values[id] ?? defaultValue;

        /* Validation: ratio must be in [0, 1]; others must be positive */
        let isInvalid = false;
        if (id === 'prefix_cache_hit_ratio') {
          const n = Number(value);
          isInvalid = value !== '' && value !== undefined && (n < 0 || n > 1);
        } else {
          isInvalid =
            value !== '' && value !== undefined && Number(value) <= 0;
        }

        return (
          <div key={id} className="mb-4">
            <label
              htmlFor={id}
              className="block text-xs font-mono uppercase tracking-wide text-text-muted mb-1.5"
            >
              {label}
            </label>
            <input
              id={id}
              type="number"
              min={id === 'prefix_cache_hit_ratio' ? '0' : '0'}
              step={id === 'prefix_cache_hit_ratio' ? '0.01' : 'any'}
              max={id === 'prefix_cache_hit_ratio' ? '1' : undefined}
              value={value}
              placeholder={placeholder}
              onChange={(e) => onChange(id, e.target.value)}
              aria-invalid={isInvalid}
              className={`${inputCls}${isInvalid ? ' border-danger' : ''}`}
            />
            {isInvalid && (
              <p id={`${id}-error`} className="mt-1 text-sm text-danger">
                {id === 'prefix_cache_hit_ratio'
                  ? 'Must be between 0 and 1.'
                  : 'Must be a positive number.'}
              </p>
            )}
            {!isInvalid && hint && (
              <p className="mt-1 text-xs text-text-muted">{hint}</p>
            )}
          </div>
        );
      })}
    </section>
  );
}
