import { validateRequiredFields, REQUIRED_FIELDS_BY_TYPE } from '../../utils/calculatorEngine.js';

/**
 * ModelFormSection — Model architecture inputs + attention type selector.
 * Shows validation errors when required fields for the selected type are missing.
 */
export default function ModelFormSection({ values = {}, onChange }) {
  const attentionType = values.attention_type ?? 'GQA';

  const isMLA       = attentionType === 'MLA' || attentionType === 'MLA_ROPE';
  const isMLA_ROPE  = attentionType === 'MLA_ROPE';
  const isSWA       = attentionType === 'SWA' || attentionType === 'SWA_GLOBAL';
  const isSWAGlobal = attentionType === 'SWA_GLOBAL';
  const isClassic   = !isMLA && !isSWA;

  /* Which required fields are currently missing for the selected type */
  const { missing } = validateRequiredFields(attentionType, values);
  const isMissing   = (id) => missing.includes(id);

  const attentionOptions = [
    { value: 'MHA',        label: 'MHA — Multi-Head Attention (GPT-2, Falcon…)' },
    { value: 'GQA',        label: 'GQA — Grouped Query Attention (Llama 3, Mistral…)' },
    { value: 'MQA',        label: 'MQA — Multi-Query Attention (Falcon-40B…)' },
    { value: 'MLA',        label: 'MLA — Multi-Head Latent Attention (Gemma 4, DeepSeek-V2…)' },
    { value: 'MLA_ROPE',   label: 'MLA + RoPE — DeepSeek-V3 / R1' },
    { value: 'SWA',        label: 'SWA — Sliding Window (Mistral 7B v0.1…)' },
    { value: 'SWA_GLOBAL', label: 'SWA + Global — Mixed layers (Gemma 2, Phi-3…)' },
  ];

  const attentionHints = {
    MHA:        'Todas las capas usan atención completa. num_key_value_heads = num_attention_heads.',
    GQA:        'num_key_value_heads < num_attention_heads. Busca ambos en config.json.',
    MQA:        'Una sola cabeza KV compartida. num_key_value_heads = 1.',
    MLA:        'K y V se comprimen en un vector latente. Busca kv_lora_rank en config.json.',
    MLA_ROPE:   'MLA con vector RoPE adicional. Busca kv_lora_rank y qk_rope_head_dim en config.json.',
    SWA:        'Todas las capas usan ventana deslizante. Busca sliding_window en config.json.',
    SWA_GLOBAL: 'Capas alternadas SWA + global. Busca sliding_window y num capas SWA en config.json.',
  };

  const inputCls =
    'w-full bg-bg-input border border-border rounded-sm px-3.5 py-2.5 font-mono text-base text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted';
  const selectCls = inputCls + ' appearance-none';

  const renderInput = ({ id, label, hint, placeholder, step = 'any', min = '1' }) => {
    const value        = values[id] ?? '';
    const isEmpty      = value === '' || value === undefined;
    const isNonPositive = !isEmpty && Number(value) <= 0;
    const isRequired   = isMissing(id);

    /* Show border-danger when: value is non-positive, OR field is required and empty */
    const showError = isNonPositive || (isRequired && isEmpty);

    let errorMsg = null;
    if (isNonPositive)        errorMsg = 'Debe ser un número positivo.';
    else if (isRequired && isEmpty) errorMsg = `Campo requerido para ${attentionType}.`;

    return (
      <div key={id} className="mb-4">
        <label
          htmlFor={id}
          className="block text-xs font-mono uppercase tracking-wide text-text-muted mb-1.5"
        >
          {label}
          {isRequired && isEmpty && (
            <span className="ml-1.5 text-danger">*</span>
          )}
        </label>
        <input
          id={id}
          type="number"
          min={min}
          step={step}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(id, e.target.value)}
          aria-invalid={showError}
          className={`${inputCls}${showError ? ' border-danger' : ''}`}
        />
        {showError && errorMsg && (
          <p className="mt-1 text-sm text-danger">{errorMsg}</p>
        )}
        {!showError && hint && (
          <p className="mt-1 text-xs text-text-muted">{hint}</p>
        )}
      </div>
    );
  };

  return (
    <section>
      <h2 className="text-lg font-bold text-text-primary mb-4">📐 Modelo</h2>

      {/* ── Attention architecture selector ── */}
      <div className="mb-4">
        <label
          htmlFor="attention_type"
          className="block text-xs font-mono uppercase tracking-wide text-text-muted mb-1.5"
        >
          Attention Architecture
        </label>
        <select
          id="attention_type"
          value={attentionType}
          onChange={(e) => onChange('attention_type', e.target.value)}
          className={selectCls}
        >
          {attentionOptions.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-text-muted">{attentionHints[attentionType]}</p>
      </div>

      {/* ── Missing fields warning banner ── */}
      {missing.length > 0 && (
        <div className="mb-4 px-3 py-2 rounded-sm border border-danger bg-danger/10 text-xs text-danger font-mono">
          Faltan campos requeridos para {attentionType}:{' '}
          {missing.join(', ')}
        </div>
      )}

      {/* ── Num hidden layers — always visible ── */}
      {renderInput({
        id: 'num_hidden_layers',
        label: 'Num Hidden Layers',
        hint: 'Profundidad del transformer (e.g. 32 para Llama 3 8B, 48 para Gemma 4 12B)',
        placeholder: '32',
        step: '1',
      })}

      {/* ── Classic KV fields: MHA / GQA / MQA / SWA ── */}
      {(isClassic || isSWA) && renderInput({
        id: 'num_key_value_heads',
        label: 'Num Key / Value Heads',
        hint: 'Cabezas KV (igual a num_attention_heads en MHA, menor en GQA/MQA)',
        placeholder: '8',
        step: '1',
      })}

      {(isClassic || isSWA) && renderInput({
        id: 'head_dim',
        label: 'Head Dim',
        hint: 'Dimensión por cabeza KV — hidden_size / num_attention_heads (e.g. 128)',
        placeholder: '128',
        step: '1',
      })}

      {/* ── MLA fields ── */}
      {isMLA && renderInput({
        id: 'kv_lora_rank',
        label: 'KV LoRA Rank',
        hint: 'Busca kv_lora_rank en config.json (e.g. 512 para Gemma 4, 512 para DeepSeek-V3)',
        placeholder: '512',
        step: '1',
      })}

      {isMLA_ROPE && renderInput({
        id: 'qk_rope_head_dim',
        label: 'QK RoPE Head Dim',
        hint: 'Busca qk_rope_head_dim en config.json (e.g. 64 para DeepSeek-V3/R1)',
        placeholder: '64',
        step: '1',
      })}

      {/* ── SWA fields ── */}
      {isSWA && renderInput({
        id: 'sliding_window',
        label: 'Sliding Window',
        hint: 'Busca sliding_window en config.json (e.g. 4096 para Mistral 7B, 8192 para Gemma 2)',
        placeholder: '4096',
        step: '1',
      })}

      {isSWAGlobal && renderInput({
        id: 'num_sliding_layers',
        label: 'Num Sliding Window Layers',
        hint: 'Capas que usan SWA. En Gemma 2 y Phi-3 suele ser la mitad del total.',
        placeholder: '14',
        step: '1',
      })}

      {/* ── Always visible ── */}
      {renderInput({
        id: 'hidden_size',
        label: 'Hidden Size',
        hint: 'Dimensión oculta total (e.g. 4096)',
        placeholder: '4096',
        step: '1',
      })}

      {renderInput({
        id: 'num_parameters',
        label: 'Num Parameters',
        hint: 'Parámetros totales (e.g. 7000000000 para un modelo 7B)',
        placeholder: '7000000000',
        step: '1',
      })}
    </section>
  );
}