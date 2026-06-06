import { clamp, getGpuColorClass } from '../utils/gpuHelpers'

/**
 * GPUDetails — Per-GPU progress bars for a PC card.
 *
 * Renders one row per GPU showing: GPU name label, color-coded occupancy bar,
 * and text readout of GB used vs total. Accepts pre-computed gpuUsage from PCCard.
 *
 * Props:
 *   gpuUsage  — Array of computed GPU usage objects from computeGpuUsage()
 */
function GPUDetails({ gpuUsage = [] }) {
  if (gpuUsage.length === 0) {
    return null
  }

  return (
    <div className="mt-4 pt-4 border-t border-border">
      {gpuUsage.map(({ gpuIndex, name, totalVram, usedVram }) => {
        const rawPercent = totalVram > 0 ? (usedVram / totalVram) * 100 : 0
        const percent = clamp(rawPercent, 0, 100)
        const colorClass = getGpuColorClass(percent)
        const isWarning = percent > 80

        return (
          <div key={gpuIndex} className="mb-3 last:mb-0">
            {/* Label row: GPU name + numeric readout */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                {name}
              </span>
              <span className="text-sm font-mono text-text-primary">
                {usedVram.toFixed(1)} / {totalVram} GB ({Math.round(rawPercent)}%)
              </span>
            </div>
            {/* Occupancy bar */}
            <div
              className={`relative overflow-hidden rounded-full h-4 bg-bg-input ${isWarning ? 'animate-gpu-warning' : ''}`}
            >
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${colorClass} animate-gpu-fill`}
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                style={{ '--gpu-target-width': `${percent}%`, width: '0%' }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default GPUDetails
