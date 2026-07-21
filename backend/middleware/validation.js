import PC from '../models/PC.js';

/* ------------------------------------------------------------------ */
/*  Helper: format a single validation error message                   */
/* ------------------------------------------------------------------ */

function fieldError(field, detail) {
  return `${field}: ${detail}`;
}

/* ------------------------------------------------------------------ */
/*  validatePcBody                                                     */
/*  Used on: POST /api/pcs , PUT /api/pcs/:id                          */
/*  Checks nombre (non-empty), ip (valid IPv4 with octet range),       */
/*          gpus array (non-empty, each entry: name string + vram > 0).*/
/*  Legacy fallback: scalar body.vram → [{ name:"GPU 1", vram }].    */
/* ------------------------------------------------------------------ */

export function validatePcBody(req, res, next) {
  const errors = [];

  /* ---.nombre --------------------------------------------------- */
  const nombre = req.body.nombre;
  if (typeof nombre !== 'string' || nombre.trim() === '') {
    errors.push(fieldError('nombre', 'Server name is required and must be a non-empty string.'));
  }

  /* ---.ip ------------------------------------------------------- */
  const ip = req.body.ip;
  if (typeof ip !== 'string') {
    errors.push(fieldError('ip', 'IP address must be a string.'));
  } else {
    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = ip.match(ipv4Pattern);
    if (!match) {
      errors.push(fieldError('ip', 'Must be a valid IPv4 address (e.g., 192.168.1.100).'));
    } else {
      const octetsValid = match.slice(1).every(o => Number.parseInt(o, 10) <= 255);
      if (!octetsValid) {
        errors.push(fieldError('ip', 'Each IPv4 octet must be between 0 and 255.'));
      }
    }
  }

  /* --- Legacy fallback: scalar vram → gpus array ---------------- */
  if (!Array.isArray(req.body.gpus) && typeof req.body.vram === 'number') {
    req.body.gpus = [{ name: 'GPU 1', vram: req.body.vram }];
  }

  /* ---.gpus (array validation) --------------------------------- */
  const gpus = req.body.gpus;

  if (!Array.isArray(gpus)) {
    errors.push(fieldError('gpus', 'Must be an array of GPU objects.'));
  } else if (gpus.length === 0) {
    errors.push(fieldError('gpus', 'At least one GPU must be defined.'));
  } else {
    /* Validate each GPU entry individually, collect ALL errors */
    gpus.forEach((gpu, idx) => {
      const prefix = `gpus[${idx}]`;

      if (typeof gpu !== 'object' || gpu === null || Array.isArray(gpu)) {
        errors.push(fieldError(prefix, 'Must be a plain object with name and vram.'));
        return; // skip field-level checks for non-object entries
      }

      /* --- .name ------------------------------------------------ */
      const gpuName = gpu.name;
      if (typeof gpuName !== 'string' || gpuName.trim() === '') {
        errors.push(fieldError(`${prefix}.name`, 'GPU name is required and must be a non-empty string.'));
      }

      /* --- .vram ------------------------------------------------ */
      const gpuVram = gpu.vram;
      if (typeof gpuVram !== 'number' || Number.isNaN(gpuVram) || gpuVram <= 0) {
        errors.push(fieldError(`${prefix}.vram`, 'GPU VRAM must be a positive number.'));
      }
    });
  }

  /* --- response ------------------------------------------------ */
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

/* ------------------------------------------------------------------ */
/*  extractPcId — helpers for routes mounted under /api/pcs/:pcId      */
/*  When a sub-router is used, Express strips mount-point params       */
/*  from req.params; we must extract pcId from req.baseUrl instead.    */
/* ------------------------------------------------------------------ */

function extractPcId(req) {
  const parts = req.baseUrl.match(/\/api\/v\d+\/pcs\/([^/]+)/);
  return parts ? parts[1] : null;
}

/* ------------------------------------------------------------------ */
/*  validateServiceBody                                                */
/*  Used on: POST /api/pcs/:pcId/services                              */
/*  Checks nombre, puerto (1–65535 integer), gpu (>=0),               */
/*          assignedGpu (valid index into pc.gpus).                    */
/*  Enforces per-GPU cap by fetching parent PC asynchronously.        */
/*  Defaults assignedGpu to 0 when omitted and PC has exactly one GPU. */
/* ------------------------------------------------------------------ */

export async function validateServiceBody(req, res, next) {
  const errors = [];

  /* ---.nombre --------------------------------------------------- */
  const nombre = req.body.nombre;
  if (typeof nombre !== 'string' || nombre.trim() === '') {
    errors.push(fieldError('nombre', 'Service name is required and must be a non-empty string.'));
  }

  /* ---.puerto --------------------------------------------------- */
  const puerto = req.body.puerto;
  if (typeof puerto !== 'number' || Number.isNaN(puerto) || !Number.isInteger(puerto)) {
    errors.push(fieldError('puerto', 'Port must be an integer.'));
  } else if (puerto < 1 || puerto > 65535) {
    errors.push(fieldError('puerto', 'Port must be between 1 and 65535.'));
  }

  /* ---.gpu ------------------------------------------------------ */
  const gpu = req.body.gpu;
  if (typeof gpu !== 'number' || Number.isNaN(gpu) || gpu < 0) {
    errors.push(fieldError('gpu', 'GPU value must be a number >= 0.'));
  }

  /* ---.assignedGpu (type check only — index validated below) ------ */
  const rawAssignedGpu = req.body.assignedGpu;
  let assignedGpuValid = true;
  if (rawAssignedGpu !== undefined) {
    if (typeof rawAssignedGpu !== 'number' || Number.isNaN(rawAssignedGpu) || !Number.isInteger(rawAssignedGpu) || rawAssignedGpu < 0) {
      errors.push(fieldError('assignedGpu', 'Must be a non-negative integer (index into the PC\'s GPUs array).'));
      assignedGpuValid = false;
    }
  }

  /* --- PC lookup ------------------------------------------------ */
  let pc;
  try {
    pc = await PC.findById(extractPcId(req));
  } catch (_) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }

  if (!pc) {
    return res.status(404).json({ success: false, message: 'PC not found' });
  }

  /* ---.assignedGpu (index-range validation + default) ------------ */
  let assignedGpu;
  if (rawAssignedGpu === undefined) {
    if (pc.gpus.length === 1) {
      assignedGpu = 0;
    } else {
      errors.push(fieldError('assignedGpu', 'Must be provided when the server has multiple GPUs.'));
      assignedGpuValid = false;
    }
  } else {
    assignedGpu = rawAssignedGpu;
  }

  /* Validate that assignedGpu is within [0, pc.gpus.length) -------- */
  if (assignedGpuValid && typeof assignedGpu === 'number' && !Number.isNaN(assignedGpu)) {
    if (assignedGpu >= pc.gpus.length) {
      errors.push(
        fieldError('assignedGpu', `GPU index ${assignedGpu} is out of range. This server has ${pc.gpus.length} GPU(s) (valid indices: 0–${pc.gpus.length - 1}).`)
      );
      assignedGpuValid = false;
    }
  }

  /* --- Per-GPU cap enforcement ---------------------------------- */
  if (errors.length === 0 && typeof gpu === 'number' && assignedGpuValid) {
    const targetGpuVram = pc.gpus[assignedGpu].vram;
    const usedByTarget = pc.servicios
      .filter(svc => svc.assignedGpu === assignedGpu)
      .reduce((sum, svc) => sum + (svc.gpu ?? 0), 0);
    const projectedTotal = usedByTarget + gpu;
    if (projectedTotal > targetGpuVram) {
      errors.push(
        fieldError('gpu', `Adding ${gpu} GB would exceed ${pc.gpus[assignedGpu].name}'s VRAM of ${targetGpuVram} GB (already using ${usedByTarget} GB on this GPU).`)
      );
    }
  }

  /* --- Store resolved assignedGpu on req for the route handler ---- */
  if (assignedGpu !== undefined) {
    req.body.assignedGpu = assignedGpu;
  }

  /* --- response ------------------------------------------------ */
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}

/* ------------------------------------------------------------------ */
/*  validateServiceUpdate                                              */
/*  Used on: PUT /api/pcs/:pcId/services/:serviceIndex                */
/*  Same field validation for whatever fields are present in body      */
/*  (partial-update aware). Enforces per-GPU cap accounting for the   */
/*  replacement by subtracting the existing service's gpu allocation  */
/*  from its current GPU and adding the new value to the target GPU. */
/*  Handles cross-GPU reassignment: if assignedGpu changes, both     */
/*  source (freed) and destination (consumed) GPUs are verified.      */
/*  Returns 404 if PC or service index not found.                     */
/* ------------------------------------------------------------------ */

export async function validateServiceUpdate(req, res, next) {
  const errors = [];

  /* --- Lookup parent PC ----------------------------------------- */
  let pc;
  try {
    pc = await PC.findById(extractPcId(req));
  } catch (_) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }

  if (!pc) {
    return res.status(404).json({ success: false, message: 'PC not found' });
  }

  /* --- Lookup service by index ---------------------------------- */
  const index = Number.parseInt(req.params.serviceIndex, 10);
  if (Number.isNaN(index) || index < 0 || index >= pc.servicios.length) {
    return res.status(404).json({ success: false, message: 'Service not found' });
  }

  const existingService = pc.servicios[index];
  const currentGpuIndex = existingService.assignedGpu;

  /* ---.nombre (only if present) --------------------------------- */
  if (req.body.nombre !== undefined) {
    if (typeof req.body.nombre !== 'string' || req.body.nombre.trim() === '') {
      errors.push(fieldError('nombre', 'Service name must be a non-empty string.'));
    }
  }

  /* ---.puerto (only if present) --------------------------------- */
  if (req.body.puerto !== undefined) {
    const puerto = req.body.puerto;
    if (typeof puerto !== 'number' || Number.isNaN(puerto) || !Number.isInteger(puerto)) {
      errors.push(fieldError('puerto', 'Port must be an integer.'));
    } else if (puerto < 1 || puerto > 65535) {
      errors.push(fieldError('puerto', 'Port must be between 1 and 65535.'));
    }
  }

  /* ---.assignedGpu type check (only if present) ----------------- */
  const rawAssignedGpu = req.body.assignedGpu;
  let assignedGpuValid = true;
  if (rawAssignedGpu !== undefined) {
    if (typeof rawAssignedGpu !== 'number' || Number.isNaN(rawAssignedGpu) || !Number.isInteger(rawAssignedGpu) || rawAssignedGpu < 0) {
      errors.push(fieldError('assignedGpu', 'Must be a non-negative integer (index into the PC\'s GPUs array).'));
      assignedGpuValid = false;
    } else if (rawAssignedGpu >= pc.gpus.length) {
      errors.push(
        fieldError('assignedGpu', `GPU index ${rawAssignedGpu} is out of range. This server has ${pc.gpus.length} GPU(s) (valid indices: 0–${pc.gpus.length - 1}).`)
      );
      assignedGpuValid = false;
    }
  }

  /* --- Determine effective target GPU index --------------------- */
  const targetGpuIndex = rawAssignedGpu !== undefined ? rawAssignedGpu : currentGpuIndex;

  /* ---.gpu (only if present) + per-GPU cap enforcement ---------- */
  if (req.body.gpu !== undefined) {
    const gpu = req.body.gpu;
    if (typeof gpu !== 'number' || Number.isNaN(gpu) || gpu < 0) {
      errors.push(fieldError('gpu', 'GPU value must be a number >= 0.'));
    } else {
      /* Only run per-GPU capacity check if assignedGpu validation passed */
      if (assignedGpuValid) {

        /* --- Projected usage on the SOURCE GPU (old assignment) --- */
        const sourceGpuUsed = pc.servicios
          .filter(svc => svc.assignedGpu === currentGpuIndex)
          .reduce((sum, svc) => sum + (svc.gpu ?? 0), 0);
        const sourceProjected = sourceGpuUsed - (existingService.gpu ?? 0);

        /* --- Projected usage on the TARGET GPU (new assignment) -- */
        let targetProjected;
        if (targetGpuIndex === currentGpuIndex) {
          /* Staying on same GPU: subtract old, add new */
          targetProjected = sourceProjected + gpu;
        } else {
          /* Cross-GPU move: target's used-vram doesn't include this service yet */
          const targetGpuUsed = pc.servicios
            .filter(svc => svc.assignedGpu === targetGpuIndex)
            .reduce((sum, svc) => sum + (svc.gpu ?? 0), 0);
          targetProjected = targetGpuUsed + gpu;
        }

        /* --- Validate against individual GPU capacities ----------- */
        const sourceGpuCap = pc.gpus[currentGpuIndex].vram;
        const targetGpuCap = pc.gpus[targetGpuIndex].vram;

        if (sourceProjected < 0) {
          errors.push(
            fieldError('gpu', `Internal inconsistency: source GPU ${currentGpuIndex} projected usage is negative. This server's state may be corrupted.`)
          );
        }

        if (targetProjected > targetGpuCap) {
          errors.push(
            fieldError('gpu', `Assigning ${gpu} GB to ${pc.gpus[targetGpuIndex].name} would exceed its VRAM of ${targetGpuCap} GB (projected usage: ${targetProjected} GB).`)
          );
        }

        if (sourceProjected > sourceGpuCap) {
          errors.push(
            fieldError('gpu', `Source GPU ${pc.gpus[currentGpuIndex].name} still exceeds its VRAM of ${sourceGpuCap} GB after removal (projected usage: ${sourceProjected} GB). Another service may have been updated concurrently.`)
          );
        }
      }
    }
  }

  /* --- assignedGpu-only change cap check ------------------------ */
  if (rawAssignedGpu !== undefined && req.body.gpu === undefined && assignedGpuValid) {
    const gpuValue = existingService.gpu ?? 0;
    if (rawAssignedGpu !== currentGpuIndex) {
      /* Cross-GPU move with no size change */
      const targetGpuUsed = pc.servicios
        .filter(svc => svc.assignedGpu === rawAssignedGpu)
        .reduce((sum, svc) => sum + (svc.gpu ?? 0), 0);
      const targetProjected = targetGpuUsed + gpuValue;
      const targetGpuCap = pc.gpus[rawAssignedGpu].vram;

      if (targetProjected > targetGpuCap) {
        errors.push(
          fieldError('assignedGpu', `Reassigning to ${pc.gpus[rawAssignedGpu].name} would exceed its VRAM of ${targetGpuCap} GB. This service needs ${gpuValue} GB but only ${(targetGpuCap - targetGpuUsed)} GB is free (projected usage: ${targetProjected} GB).`)
        );
      }
    }
  }

  /* --- Store resolved assignedGpu on req for the route handler ---- */
  if (rawAssignedGpu !== undefined) {
    req.body.assignedGpu = rawAssignedGpu;
  }

  /* --- response ------------------------------------------------ */
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next();
}
