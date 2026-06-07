import { clamp, getGpuColorClass } from '../../utils/gpuHelpers.js';

const METRIC_ROWS = [
  { label: 'Model Weights',        key: 'modelSizeGB',          unit: 'GB' },
  { label: 'KV Cache / Sequence',  key: 'kvCachePerSeqGB',      unit: 'GB' },
  { label: 'Total KV Cache',       key: 'totalKvCacheGB',       unit: 'GB' },
  { label: 'Available VRAM',       key: 'availableVramGB',      unit: 'GB', showBar: false },
  { label: 'Used VRAM (effective)', key: 'usedVramGB',          unit: 'GB' },
  { label: 'Remaining VRAM',       key: 'remainingVramGB',      unit: 'GB', invertColor: true },
  { label: 'Prefix Cache Savings', key: 'prefixCacheSavingsGB', unit: 'GB', showBar: false },
];

const WARNING_THRESHOLD = 80;

/* Safely format a value that may be null */
function fmt(value) {
  if (value === null || value === undefined) return '—';
  return value.toFixed(2);
}

export default function ResultsDisplay({ results, missingFields = [] }) {
  const data = results ?? {};

  /* Guard: only render content when key values are non-null and positive */
  const hasData =
    data.availableVramGB !== null &&
    data.availableVramGB > 0 &&
    data.modelSizeGB !== null &&
    data.modelSizeGB > 0;

  /* Show incomplete-data state when KV cache couldn't be calculated */
  const kvIncomplete = data.kvCachePerSeqGB === null;

  const usagePercent = hasData && data.vramUsagePercent !== null
    ? clamp(data.vramUsagePercent, 0, 100)
    : null;

  const colorClass = usagePercent !== null ? getGpuColorClass(usagePercent) : 'bg-gpu-yellow';
  const isWarning  = usagePercent !== null && usagePercent > WARNING_THRESHOLD;

  /* Empty state */
  if (!hasData) {
    return (
      <div className="rounded-lg border border-border bg-bg-card p-6 min-h-[280px] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-bold text-text-secondary mb-1">Sin resultados</p>
          <p className="text-sm text-text-muted">
            Rellena los campos del formulario para ver la estimación de VRAM.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card p-6">
      <h2 className="text-lg font-bold text-text-primary mb-4">📊 Results</h2>

      {/* ── KV cache incomplete warning ── */}
      {kvIncomplete && (
        <div className="mb-4 px-3 py-2 rounded-sm border border-warning bg-warning/10 text-xs text-warning font-mono">
          KV cache no calculado — faltan campos requeridos para la arquitectura seleccionada.
          El resto de valores son parciales.
        </div>
      )}

      {/* ── Summary card ── */}
      <div className="mb-6 p-4 rounded-md bg-bg-input border border-border">
        <div className="flex items-center gap-3 mb-3">
          <span
            className={`inline-block w-3.5 h-3.5 rounded-full ${colorClass}${isWarning ? ' animate-gpu-warning' : ''}`}
            aria-hidden="true"
          />
          <span className="text-sm font-bold text-text-primary">VRAM Usage</span>
        </div>

        <div className="flex items-baseline justify-between mb-3">
          <span className="text-xl font-mono font-bold text-text-primary">
            {fmt(data.usedVramGB)}
            <span className="text-sm font-normal ml-1.5 text-text-secondary">
              / {fmt(data.availableVramGB)} GB
            </span>
          </span>
          {usagePercent !== null && (
            <span className={`text-sm font-mono font-bold ${
              colorClass === 'bg-gpu-green'  ? 'text-gpu-green'  :
              colorClass === 'bg-gpu-yellow' ? 'text-gpu-yellow' : 'text-gpu-red'
            }`}>
              {Math.round(usagePercent)}%
            </span>
          )}
          {usagePercent === null && (
            <span className="text-sm font-mono text-text-muted">—%</span>
          )}
        </div>

        {/* Main VRAM usage bar */}
        <div className="relative overflow-hidden rounded-full h-4 bg-bg-input">
          {usagePercent !== null ? (
            <div
              role="progressbar"
              aria-valuenow={Math.round(usagePercent)}
              aria-valuemin="0"
              aria-valuemax="100"
              className={`absolute inset-y-0 left-0 h-full ${colorClass} animate-gpu-fill${isWarning ? ' animate-gpu-warning' : ''}`}
              style={{ '--gpu-target-width': `${usagePercent}%` }}
            />
          ) : (
            <div className="absolute inset-y-0 left-0 h-full w-full bg-border opacity-30 rounded-full" />
          )}
        </div>
      </div>

      {/* ── Metric rows ── */}
      <div className="space-y-4">
        {METRIC_ROWS.map(({ label, key, unit, showBar, invertColor }) => {
          const value = data[key];
          const isNull = value === null || value === undefined;

          let barPercent = null;
          if (!isNull && showBar !== false && data.availableVramGB > 0) {
            barPercent = clamp((value / data.availableVramGB) * 100, 0, 100);
          }

          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono uppercase tracking-wide text-text-muted">
                  {label}
                </span>
                <span className={`text-sm font-bold font-mono ${isNull ? 'text-text-muted' : 'text-text-primary'}`}>
                  {fmt(value)}{' '}
                  <span className="font-normal text-text-secondary">{unit}</span>
                </span>
              </div>

              {barPercent !== null && (
                <div className="relative overflow-hidden rounded-full h-3 bg-bg-input">
                  <div
                    role="progressbar"
                    aria-valuenow={Math.round(barPercent)}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    className={`absolute inset-y-0 left-0 h-full ${getGpuColorClass(invertColor ? 100 - barPercent : barPercent)} animate-gpu-fill`}
                    style={{ '--gpu-target-width': `${barPercent}%` }}
                  />
                </div>
              )}

              {isNull && showBar !== false && (
                <div className="relative overflow-hidden rounded-full h-3 bg-bg-input opacity-30" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}