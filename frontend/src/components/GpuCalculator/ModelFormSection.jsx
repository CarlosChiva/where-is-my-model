import { validateRequiredFields, REQUIRED_FIELDS_BY_TYPE } from '../../utils/calculatorEngine.js';

export default function ModelFormSection({ values = {}, onChange }) {
  const attentionType = values.attention_type ?? 'GQA';

  const isMLA          = attentionType === 'MLA' || attentionType === 'MLA_ROPE';
  const isMLA_ROPE     = attentionType === 'MLA_ROPE';
  const isSWA          = attentionType === 'SWA' || attentionType === 'SWA_GLOBAL' || attentionType === 'SWA_DUAL';
  const isSWA_GLOBAL   = attentionType === 'SWA_GLOBAL';
  const isSWA_DUAL     = attentionType === 'SWA_DUAL';
  const isHybridDelta  = attentionType === 'HYBRID_DELTANET';
  const isClassic      = !isMLA && !isSWA && !isHybridDelta;
const isLinearAttention = attentionType === 'LINEAR_ATTENTION';
const isMamba           = attentionType === 'MAMBA';
const isRWKV            = attentionType === 'RWKV';
const isHybridMamba     = attentionType === 'HYBRID_MAMBA';
  const { missing } = validateRequiredFields(attentionType, values);
  const isMissing   = (id) => missing.includes(id);

  const attentionOptions = [
    { value: 'MHA',             label: 'MHA — Multi-Head Attention (GPT-2, Falcon…)' },
    { value: 'GQA',             label: 'GQA — Grouped Query Attention (Llama 3, Mistral…)' },
    { value: 'MQA',             label: 'MQA — Multi-Query Attention (Falcon-40B…)' },
    { value: 'MLA',             label: 'MLA — Multi-Head Latent Attention (DeepSeek-V2…)' },
    { value: 'MLA_ROPE',        label: 'MLA + RoPE — DeepSeek-V3 / R1' },
    { value: 'SWA',             label: 'SWA — Sliding Window puro (Mistral 7B v0.1…)' },
    { value: 'SWA_GLOBAL',      label: 'SWA + Global misma geometría (Gemma 2, Phi-3…)' },
    { value: 'SWA_DUAL',        label: 'SWA + Global geometría dual (Gemma 4 12B / 31B…)' },
    { value: 'HYBRID_DELTANET', label: 'Hybrid DeltaNet + Attention (Falcon H1…)' },
  { value: 'LINEAR_ATTENTION', label: 'Linear Attention (Kimi Linear, RetNet...)' },
{ value: 'MAMBA',            label: 'Mamba State Space Model' },
{ value: 'RWKV',             label: 'RWKV Recurrent Transformer' },
{ value: 'HYBRID_MAMBA',     label: 'Hybrid Mamba + Attention (Jamba)' },
  ];

  const attentionHints = {
    MHA:             'Todas las capas usan atención completa. num_key_value_heads = num_attention_heads.',
    GQA:             'num_key_value_heads < num_attention_heads. Busca ambos en config.json.',
    MQA:             'Una sola cabeza KV compartida. num_key_value_heads = 1.',
    MLA:             'K y V se comprimen en un vector latente. Busca kv_lora_rank en config.json.',
    MLA_ROPE:        'MLA con vector RoPE adicional. Busca kv_lora_rank y qk_rope_head_dim en config.json.',
    SWA:             'Todas las capas usan ventana deslizante. Busca sliding_window en config.json.',
    SWA_GLOBAL:      'Capas SWA + capas globales con la misma geometría KV. (Gemma 2, Phi-3)',
    SWA_DUAL:        'Capas SWA y capas globales con head_dim y kv_heads distintos. (Gemma 4)',
    HYBRID_DELTANET: 'Capas DeltaNet (estado fijo recurrente) alternadas con capas de atención cuadrática. (Falcon H1)',
    LINEAR_ATTENTION:'Estado recurrente fijo por capa. No genera KV cache proporcional al contexto.',
    MAMBA:           'Modelo State Space. Mantiene estado fijo independiente del contexto.',
    RWKV:            'Arquitectura recurrente. El estado no crece con seq_len.',
    HYBRID_MAMBA:    'Capas de atención mezcladas con capas Mamba (Jamba).',
  };

  const inputCls =
    'w-full bg-bg-input border border-border rounded-sm px-3.5 py-2.5 font-mono text-base text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted';
  const selectCls = inputCls + ' appearance-none';

  const renderInput = ({ id, label, hint, placeholder, step = 'any', min = '1' }) => {
    const value         = values[id] ?? '';
    const isEmpty       = value === '' || value === undefined;
    const isNonPositive = !isEmpty && Number(value) <= 0;
    const isRequired    = isMissing(id);
    const showError     = isNonPositive || (isRequired && isEmpty);

    let errorMsg = null;
    if (isNonPositive)           errorMsg = 'Debe ser un número positivo.';
    else if (isRequired && isEmpty) errorMsg = `Campo requerido para ${attentionType}.`;

    return (
      <div key={id} className="mb-4">
        <label
          htmlFor={id}
          className="block text-xs font-mono uppercase tracking-wide text-text-muted mb-1.5"
        >
          {label}
          {isRequired && isEmpty && <span className="ml-1.5 text-danger">*</span>}
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
        {showError && errorMsg && <p className="mt-1 text-sm text-danger">{errorMsg}</p>}
        {!showError && hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
      </div>
    );
  };

  const renderCheckbox = ({ id, label, hint }) => {
    const checked = values[id] === true || values[id] === 'true';
    return (
      <div key={id} className="mb-4">
        <label htmlFor={id} className="flex items-center gap-2 cursor-pointer">
          <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(id, e.target.checked)}
            className="w-4 h-4 accent-accent"
          />
          <span className="text-xs font-mono uppercase tracking-wide text-text-muted">{label}</span>
        </label>
        {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
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
          Faltan campos requeridos para {attentionType}: {missing.join(', ')}
        </div>
      )}

      {/* ── Num hidden layers — always visible ── */}
      {renderInput({
        id: 'num_hidden_layers',
        label: 'Num Hidden Layers',
        hint: 'Profundidad total del transformer (e.g. 32 → Llama 3 8B, 48 → Gemma 4 12B)',
        placeholder: '32',
        step: '1',
      })}

      {/* ── Classic KV fields: MHA / GQA / MQA / SWA / SWA_GLOBAL / SWA_DUAL / HYBRID ── */}
      {(isClassic || isSWA || isHybridDelta) && renderInput({
        id: 'num_key_value_heads',
        label: isSWA_DUAL ? 'KV Heads (capas sliding)' : 'Num Key / Value Heads',
        hint: isSWA_DUAL
          ? 'KV heads de las capas sliding. Busca num_key_value_heads en config.json (e.g. 16 para Gemma 4 12B)'
          : 'Cabezas KV (igual a num_attention_heads en MHA, menor en GQA/MQA)',
        placeholder: isSWA_DUAL ? '16' : '8',
        step: '1',
      })}

      {(isClassic || isSWA || isHybridDelta) && renderInput({
        id: 'head_dim',
        label: isSWA_DUAL ? 'Head Dim (capas sliding)' : 'Head Dim',
        hint: isSWA_DUAL
          ? 'Dimensión por cabeza en capas sliding. Busca head_dim en config.json (e.g. 256 para Gemma 4 12B)'
          : 'Dimensión por cabeza KV — hidden_size / num_attention_heads (e.g. 128)',
        placeholder: isSWA_DUAL ? '256' : '128',
        step: '1',
      })}

      {/* ── MLA fields ── */}
      {isMLA && renderInput({
        id: 'kv_lora_rank',
        label: 'KV LoRA Rank',
        hint: 'Busca kv_lora_rank en config.json (e.g. 512 para DeepSeek-V2/V3)',
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
        label: 'Sliding Window (tokens)',
        hint: 'Busca sliding_window en config.json (e.g. 1024 para Gemma 4, 4096 para Mistral 7B)',
        placeholder: '1024',
        step: '1',
      })}

      {isSWA_GLOBAL && renderInput({
        id: 'num_sliding_layers',
        label: 'Num Sliding Window Layers',
        hint: 'Capas que usan SWA. En Gemma 2 y Phi-3 suele ser la mitad del total.',
        placeholder: '14',
        step: '1',
      })}

      {/* ── SWA_DUAL extra fields (Gemma 4) ── */}
      {isSWA_DUAL && renderInput({
        id: 'sliding_window_pattern',
        label: 'Sliding Window Pattern',
        hint: 'Cada N capas hay una capa global. Busca sliding_window_pattern en config.json (e.g. 6 para Gemma 4)',
        placeholder: '6',
        step: '1',
      })}

      {isSWA_DUAL && renderInput({
        id: 'num_global_key_value_heads',
        label: 'KV Heads (capas globales)',
        hint: 'Busca num_global_key_value_heads en config.json (e.g. 4 para Gemma 4 12B)',
        placeholder: '4',
        step: '1',
      })}

      {isSWA_DUAL && renderInput({
        id: 'global_head_dim',
        label: 'Head Dim (capas globales)',
        hint: 'Busca global_head_dim en config.json (e.g. 512 para Gemma 4 12B)',
        placeholder: '512',
        step: '1',
      })}

      {isSWA_DUAL && renderCheckbox({
        id: 'attention_k_eq_v',
        label: 'K = V en capas globales (attention_k_eq_v)',
        hint: 'Si está activo, las capas globales reutilizan K como V — el KV cache global se reduce a la mitad. Busca attention_k_eq_v en config.json (true en Gemma 4)',
      })}

      {/* ── HYBRID_DELTANET extra fields ── */}
      {isHybridDelta && renderInput({
        id: 'num_attention_layers',
        label: 'Num Full Attention Layers',
        hint: 'Capas de atención cuadrática completa (las que generan KV cache creciente)',
        placeholder: '16',
        step: '1',
      })}

      {isHybridDelta && renderInput({
        id: 'deltanet_num_heads',
        label: 'DeltaNet Num Heads',
        hint: 'Cabezas en las capas DeltaNet. Busca num_heads en las capas deltanet del config.json',
        placeholder: '16',
        step: '1',
      })}

      {isHybridDelta && renderInput({
        id: 'deltanet_head_dim',
        label: 'DeltaNet Head Dim',
        hint: 'Dimensión por cabeza en capas DeltaNet. El estado es head_dim × head_dim por cabeza.',
        placeholder: '256',
        step: '1',
      })}
      {isLinearAttention && renderInput({
        id: 'linear_num_heads',
        label: 'Linear Attention Heads',
        hint: 'Número de cabezas recurrentes',
        placeholder: '16',
        step: '1',
      })}

      {isLinearAttention && renderInput({
        id: 'linear_head_dim',
        label: 'Linear Head Dim',
        hint: 'Dimensión por cabeza',
        placeholder: '256',
        step: '1',
      })}
      {(isMamba || isRWKV) && renderInput({
  id: 'state_size',
  label: 'State Size',
  hint: 'd_state del modelo',
  placeholder: '64',
  step: '1',
})}
{isHybridMamba && renderInput({
  id: 'num_attention_layers',
  label: 'Num Attention Layers',
  hint: 'Capas que usan atención tradicional',
  placeholder: '16',
  step: '1',
})}

{isHybridMamba && renderInput({
  id: 'hybrid_state_size',
  label: 'Mamba State Size',
  hint: 'd_state de las capas Mamba',
  placeholder: '64',
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
        hint: 'Parámetros totales (e.g. 7 para un modelo 7B)',
        placeholder: '7',
        step: '1',
      })}
    </section>
  );
}