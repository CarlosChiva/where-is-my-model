import { getRemainingVram } from './gpuHelpers.js';

const IPV4_PATTERN = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;

/**
 * validatePcForm — Validate a PC (server) data object.
 * Returns { valid: boolean, errors: { nombre?, ip?, gpus?, "gpus[N]"? }, warnings: string[] }
 */
export function validatePcForm(data) {
  const errors = {};
  const warnings = [];
  const { nombre, ip, gpus } = data || {};

  /* ── nombre (unchanged) ─────────────────────────────── */
  if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
    errors.nombre = 'Server name is required.';
  }

  /* ── ip (unchanged) ─────────────────────────────────── */
  if (!ip || typeof ip !== 'string' || !ip.trim()) {
    errors.ip = 'IP address is required.';
  } else if (!IPV4_PATTERN.test(ip)) {
    errors.ip = 'Must be a valid IPv4 address (e.g., 192.168.1.100).';
  } else {
    const octets = ip.split('.').map(Number);
    const octetValid = octets.every((o) => o >= 0 && o <= 255);
    if (!octetValid) {
      errors.ip = 'Each octet must be between 0 and 255.';
    }
  }

  /* ── gpus array (replaces vram) ─────────────────────── */
  if (!Array.isArray(gpus) || gpus.length === 0) {
    errors.gpus = 'At least one GPU must be defined for this server.';
  } else {
    gpus.forEach((gpu, idx) => {
      /* Auto-populate missing name with 1-based label */
      if (!gpu.name || typeof gpu.name !== 'string' || !gpu.name.trim()) {
        gpu.name = `GPU ${idx + 1}`;
        warnings.push(`Automatically named GPU ${idx + 1}.`);
      } else {
        gpu.name = gpu.name.trim();
      }

      /* Validate VRAM per-GPU */
      const vramNum = Number(gpu.vram);
      if (gpu.vram === undefined || gpu.vram === null || gpu.vram === '' || isNaN(vramNum) || vramNum < 1) {
        errors[`gpus[${idx}]`] = `GPU ${idx + 1} VRAM must be a positive number (≥ 1 GB).`;
      }
    });
  }

  return { valid: Object.keys(errors).length === 0, errors, warnings };
}

/**
 * validateServiceForm — Validate a Service data object.
 * Returns { valid: boolean, errors: { nombre?, puerto?, gpu?, assignedGpu? } }
 *
 * @param {Object}   data      - Service form data ({ nombre, puerto, gpu, assignedGpu })
 * @param {?Array}   [services] - Existing services on the PC (excluding the one being validated).
 *                                For ADD: all current services.  For EDIT: services minus
 *                                the entry currently under edit, so the capacity check
 *                                excludes its prior allocation.
 * @param {?Array}   [gpus]    - PC's gpus array [{ name, vram }] for per-GPU capacity checks.
 */
export function validateServiceForm(data, services, gpus) {
  const errors = {};
  const { nombre, puerto, gpu, assignedGpu } = data || {};

  /* ── nombre (unchanged) ─────────────────────────────── */
  if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
    errors.nombre = 'Service name is required.';
  }

  /* ── puerto (unchanged) ──────────────────────────────── */
  const portNum = Number(puerto);
  if (puerto === undefined || puerto === null || puerto === '' ||
      isNaN(portNum) || !Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    errors.puerto = 'Port must be a number between 1 and 65535.';
  }

  /* ── gpu usage (preserves existing ≥ 0 threshold) ────── */
  const gpuNum = Number(gpu);
  if (gpu === undefined || gpu === null || gpu === '' || isNaN(gpuNum) || gpuNum < 0) {
    errors.gpu = 'GPU usage must be a number ≥ 0.';
  }

  /* ── assignedGpu index validation ─────────────────────── */
  const assignedIdx = Number(assignedGpu);
  if (assignedGpu === undefined || assignedGpu === null || assignedGpu === '') {
    errors.assignedGpu = 'Please select a GPU for this service.';
  } else if (!Number.isInteger(assignedIdx) || assignedIdx < 0) {
    errors.assignedGpu = 'GPU index must be a non-negative integer.';
  } else if (Array.isArray(gpus) && assignedIdx >= gpus.length) {
    errors.assignedGpu = `Selected GPU index ${assignedIdx} is out of range.`;
  }

  /* ── per-GPU VRAM capacity check (replaces total-vram cap) ──── */
  if (Array.isArray(gpus) && Number.isInteger(assignedIdx) && assignedIdx >= 0 &&
      assignedIdx < gpus.length && gpuNum >= 0) {
    const svcs = Array.isArray(services) ? services : [];
    const remaining = getRemainingVram(gpus, svcs, assignedIdx);
    if (gpuNum > remaining) {
      errors.gpu = `Not enough free VRAM on ${gpus[assignedIdx].name}. Only ${remaining} GB remaining.`;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
