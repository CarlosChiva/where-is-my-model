export default function HardwareFormSection({ values = {}, onChange }) {
  const fields = [
    {
      id: 'vram_total_gb',
      label: 'Total VRAM (GB)',
      hint: 'Memoria total de la GPU en gigabytes (e.g. 80 para una A100 80 GB)',
      placeholder: '80',
      default: 80,
      step: '1',
      max: undefined,
      validate: (n) => n <= 0,
      errorMsg: 'Must be a positive number.',
    },
    {
      id: 'gpu_memory_utilization',
      label: 'GPU Memory Utilization',
      hint: null,
      placeholder: '0.90',
      default: 0.90,
      step: '0.01',
      max: '1',
      validate: (n) => n <= 0 || n > 1,
      errorMsg: 'Must be between 0 and 1.',
    },
    {
      id: 'activation_overhead_gb',
      label: 'Activation Overhead (GB)',
      hint: 'Buffer para activaciones, CUDA Graphs y runtime de PyTorch. Recomendado: 1.5–3 GB con speculative decoding.',
      placeholder: '1.5',
      default: 1.5,
      step: '0.1',
      max: undefined,
      validate: (n) => n < 0,
      errorMsg: 'Must be 0 or greater.',
    },
  ];

  const inputCls =
    'w-full bg-bg-input border border-border rounded-sm px-3.5 py-2.5 font-mono text-base text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted';

  return (
    <section>
      <h2 className="text-lg font-bold text-text-primary mb-4">🖥️ Hardware</h2>

      {fields.map(({ id, label, hint, placeholder, default: defaultValue, step, max, validate, errorMsg }) => {
        const value = values[id] ?? defaultValue;

        const displayHint =
          id === 'gpu_memory_utilization' && value !== '' && value !== undefined
            ? `Usando el ${(Number(value) * 100).toFixed(0)}% de la VRAM`
            : hint;

        const isInvalid = value !== '' && value !== undefined && validate(Number(value));

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
              min="0"
              step={step}
              max={max}
              value={value}
              placeholder={placeholder}
              onChange={(e) => onChange(id, e.target.value)}
              aria-invalid={isInvalid}
              className={`${inputCls}${isInvalid ? ' border-danger' : ''}`}
            />
            {isInvalid && (
              <p className="mt-1 text-sm text-danger">{errorMsg}</p>
            )}
            {!isInvalid && displayHint && (
              <p className="mt-1 text-xs text-text-muted">{displayHint}</p>
            )}
          </div>
        );
      })}
    </section>
  );
}