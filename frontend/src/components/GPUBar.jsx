import { clamp, getGpuColorClass } from '../utils/gpuHelpers'

export default function GPUBar({ gpuGb, vramGb }) {
  const percent = vramGb > 0 ? clamp((gpuGb / vramGb) * 100, 0, 100) : 0
  const colorClass = getGpuColorClass(percent)
  const isWarning = percent > 80

  return (
    <div className={`relative w-full h-2.5 bg-bg-input rounded-full overflow-hidden${isWarning ? ' animate-gpu-warning' : ''}`}>
      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin="0"
        aria-valuemax="100"
        className={`absolute inset-y-0 left-0 h-full ${colorClass} animate-gpu-fill`}
        style={{ '--gpu-target-width': `${percent}%`, width: '0%' }}
      />
    </div>
  )
}
