/**
 * getGpuColorClass — Map a GPU percentage to a Tailwind background-color class.
 *   ≤ 35 → 'bg-gpu-green'   (#3fb950)
 *   36-70 → 'bg-gpu-yellow' (#d29922)
 *   > 70  → 'bg-gpu-red'    (#f85149)
 */
export function getGpuColorClass(percent) {
  if (percent <= 35) return 'bg-gpu-green';
  if (percent <= 70) return 'bg-gpu-yellow';
  return 'bg-gpu-red';
}

/**
 * clamp — Restrict a numeric value to an inclusive [min, max] range.
 */
export function clamp(value, min = 0, max = 100) {
  const num = Number(value);
  if (Number.isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
}

/**
 * computeGpuUsage — Compute per-GPU VRAM consumption from a PC's gpus array
 * and its services array. Supports legacy data that lacks assignedGpu by
 * treating such services as assigned to GPU 0.
 *
 * @param {Array<Object>}   gpus      - Array of { name: string, vram: number }
 * @param {?Array<Object>} [services] - Array of service objects with .gpu (number)
 *                                     and optionally .assignedGpu (number index).
 * @returns {Array<Object>} Array of { gpuIndex, name, totalVram, usedVram }.
 */
export function computeGpuUsage(gpus, services) {
  const svcs = Array.isArray(services) ? services : [];

  return gpus.map((gpuDef, idx) => ({
    gpuIndex: idx,
    name: gpuDef.name,
    totalVram: gpuDef.vram,
    usedVram: svcs
      .filter(svc => (svc.assignedGpu ?? 0) === idx)
      .reduce((sum, svc) => sum + (svc.gpu ?? 0), 0),
  }));
}

/**
 * getRemainingVram — Return the free VRAM (in GB) on a specific GPU index.
 * Services without assignedGpu are treated as belonging to GPU 0.
 *
 * @param {Array<Object>}   gpus      - Array of { name: string, vram: number }
 * @param {?Array<Object>} [services] - Service array (may be undefined).
 * @param {number}         gpuIndex   - Zero-based index into the gpus array.
 * @returns {number} Remaining VRAM in GB; clamped to 0 minimum.
 */
export function getRemainingVram(gpus, services, gpuIndex) {
  const svcs = Array.isArray(services) ? services : [];

  if (!Array.isArray(gpus) || gpuIndex < 0 || gpuIndex >= gpus.length) {
    return 0;
  }

  const usedVram = svcs
    .filter(svc => (svc.assignedGpu ?? 0) === gpuIndex)
    .reduce((sum, svc) => sum + (svc.gpu ?? 0), 0);

  return Math.max(0, gpus[gpuIndex].vram - usedVram);
}
