import { useState } from 'react';

import ModelFormSection     from './ModelFormSection';
import PrecisionFormSection from './PrecisionFormSection';
import HardwareFormSection  from './HardwareFormSection';
import WorkloadFormSection  from './WorkloadFormSection';
import ResultsDisplay       from './ResultsDisplay';

import {
  calculateModelSizeGB,
  calculateKvCachePerSeqGB,
  calculateTotalKvCacheGB,
  getAvailableVram,
  getUsedVramWithPrefixCache,
  calculatePrefixCacheSavingsGB,
  getRemainingVram,
  getVramUsagePercent,
} from '../../utils/calculatorEngine.js';

const DEFAULT_STATE = {
  // Model
  num_hidden_layers:      '32',
  num_key_value_heads:    '8',
  head_dim:               '128',
  hidden_size:            '4096',
  num_parameters:         '7000000000',
  // Attention architecture
  attention_type:         'GQA',
  kv_lora_rank:           '512',
  qk_rope_head_dim:       '64',
  sliding_window:         '4096',
  num_sliding_layers:     '14',
  // Precision
  dtype_bytes:            '2',
  kv_cache_dtype_bytes:   '2',
  // Hardware
  vram_total_gb:          '32',
  gpu_memory_utilization: '0.90',
  activation_overhead_gb: '1.5',
  // Workload
  max_model_len:          '4096',
  max_num_seqs:           '1',
  avg_prompt_len:         '256',
  avg_output_len:         '1024',
  prefix_cache_hit_ratio: '0.5',
};

export default function GPUCalculatorPage() {
  const [formState, setFormState] = useState(DEFAULT_STATE);

  const handleChange = (fieldName, value) => {
    setFormState((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleReset = () => setFormState({ ...DEFAULT_STATE });

  /* ═══  Derived results ═══ */
  const modelSizeGB     = calculateModelSizeGB(
    formState.num_parameters,
    formState.dtype_bytes,
  );

  const kvCachePerSeqGB = calculateKvCachePerSeqGB(
    formState.num_hidden_layers,
    formState.num_key_value_heads,
    formState.head_dim,
    formState.max_model_len,
    formState.kv_cache_dtype_bytes,
    formState.attention_type,
    formState.kv_lora_rank,
    formState.qk_rope_head_dim,
    formState.sliding_window,
    formState.num_sliding_layers,
  );

  const totalKvCacheGB  = calculateTotalKvCacheGB(
    kvCachePerSeqGB,
    formState.max_num_seqs,
  );

  const availableVramGB = getAvailableVram(
    formState.vram_total_gb,
    formState.gpu_memory_utilization,
  );

  const usedVramGB      = getUsedVramWithPrefixCache(
    modelSizeGB,
    kvCachePerSeqGB,
    formState.max_num_seqs,
    formState.prefix_cache_hit_ratio,
    formState.activation_overhead_gb,
  );

  const prefixCacheSavingsGB = calculatePrefixCacheSavingsGB(
    kvCachePerSeqGB,
    formState.max_num_seqs,
    formState.prefix_cache_hit_ratio,
  );

  const remainingVramGB  = getRemainingVram(availableVramGB, usedVramGB);
  const vramUsagePercent = getVramUsagePercent(usedVramGB, availableVramGB);

  const results = {
    modelSizeGB,
    kvCachePerSeqGB,
    totalKvCacheGB,
    availableVramGB,
    usedVramGB,
    remainingVramGB,
    vramUsagePercent,
    prefixCacheSavingsGB,
    activationOverheadGB: parseFloat(formState.activation_overhead_gb) || 1.5,
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary font-sans p-4 md:p-8">
      <main>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <h1 className="text-2xl font-bold text-text-primary">
            🧮 GPU VRAM Calculator
          </h1>
          <button
            type="button"
            onClick={handleReset}
            className="self-start sm:self-auto px-4 py-2 rounded-sm border border-border bg-bg-elevated text-sm font-mono text-text-secondary hover:text-text-primary hover:border-accent transition-colors cursor-pointer"
          >
            ↺ Reset defaults
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-lg border border-border bg-bg-elevated p-6">
              <ModelFormSection values={formState} onChange={handleChange} />
            </div>
            <div className="rounded-lg border border-border bg-bg-elevated p-6">
              <PrecisionFormSection values={formState} onChange={handleChange} />
            </div>
            <div className="rounded-lg border border-border bg-bg-elevated p-6">
              <HardwareFormSection values={formState} onChange={handleChange} />
            </div>
            <div className="rounded-lg border border-border bg-bg-elevated p-6">
              <WorkloadFormSection values={formState} onChange={handleChange} />
            </div>
          </div>

          <aside className="lg:sticky lg:top-8 h-fit">
            <ResultsDisplay results={results} />
          </aside>
        </div>
      </main>
    </div>
  );
}