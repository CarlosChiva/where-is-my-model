import mongoose from 'mongoose';

/* ------------------------------------------------------------------ */
/*  Service subdocument schema                                        */
/* ------------------------------------------------------------------ */

const serviceSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'Service name is required.'],
      trim: true,
    },
    puerto: {
      type: Number,
      required: [true, 'Port number is required.'],
      min: [1, 'Port must be at least 1.'],
      max: [65535, 'Port must not exceed 65535.'],
    },
    gpu: {
      type: Number,
      required: [true, 'GPU value is required.'],
      min: [0, 'GPU usage must be >= 0.'],
    },
    assignedGpu: {
      type: Number,
      required: [true, 'assignedGpu field is required.'],
      min: [0, 'GPU index must be >= 0.'],
    },
  },
  { _id: false } // Subdocuments do not need their own ObjectId
);

/* ------------------------------------------------------------------ */
/*  PC schema                                                         */
/* ------------------------------------------------------------------ */

const pcSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'Server name is required.'],
      trim: true,
    },
    ip: {
      type: String,
      required: [true, 'IP address is required.'],
      match: [
        /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/,
        'Must be a valid IPv4 address (e.g., 192.168.1.100).',
      ],
    },
    gpus: {
      type: [
        {
          name: {
            type: String,
            required: [true, 'GPU name is required.'],
          },
          vram: {
            type: Number,
            required: [true, 'GPU VRAM is required.'],
            min: [1, 'Each GPU must have at least 1 GB VRAM.'],
          },
        }
      ],
      default: [],
    },
    servicios: {
      type: [serviceSchema],
      default: [], // ← new PCs start with zero services
    },
  },
  {
    timestamps: true, // Adds createdAt / updatedAt automatically
    toJSON: { virtuals: true }, // Serialize virtual fields like gpuUsage
    toObject: { virtuals: true }, // Available on model instances in Node context
  }
);

/* ------------------------------------------------------------------ */
/*  Custom validator: gpus array non-empty                             */
/* ------------------------------------------------------------------ */

pcSchema.path('gpus').validate(
  function (arr) {
    if (!Array.isArray(arr)) {
      return true; // let type validation handle non-arrays
    }
    return arr.length >= 1;
  },
  'At least one GPU must be defined for this server.'
);

/* ------------------------------------------------------------------ */
/*  Virtual field: gpuUsage — per-GPU VRAM utilization breakdown       */
/* ------------------------------------------------------------------ */

pcSchema.virtual('gpuUsage').get(function () {
  return this.gpus.map((gpuDef, idx) => ({
    gpuIndex: idx,
    name: gpuDef.name,
    totalVram: gpuDef.vram,
    usedVram: this.servicios
      .filter(svc => svc.assignedGpu === idx)
      .reduce((sum, svc) => sum + (svc.gpu ?? 0), 0),
  }));
});

/* ------------------------------------------------------------------ */
/*  Custom validator: per-GPU cap                                     */
/*  For each GPU at index i, sum of servicios assigned to that GPU    */
/*  must not exceed gpus[i].vram.  Rejects out-of-bounds              */
/*  assignedGpu references (stale after GPU removal).                 */
/* ------------------------------------------------------------------ */

pcSchema.path('servicios').validate(
  function (arr) {
    if (!Array.isArray(arr)) {
      return true; // let type validation handle non-arrays
    }
    const gpuList = this.gpus;
    if (!Array.isArray(gpuList) || gpuList.length === 0) {
      return arr.length === 0; // no GPUs defined → no services allowed
    }

    for (const svc of arr) {
      const target = svc.assignedGpu;
      /* Reject stale reference: service points to a GPU that does not exist */
      if (typeof target !== 'number' || target < 0 || target >= gpuList.length) {
        return false;
      }
    }

    for (let i = 0; i < gpuList.length; i++) {
      const usedVram = arr
        .filter(svc => svc.assignedGpu === i)
        .reduce((sum, svc) => sum + (svc.gpu ?? 0), 0);
      if (usedVram > gpuList[i].vram) {
        return false;
      }
    }

    return true;
  },
  'GPU allocation exceeds capacity on one or more GPUs, or references a non-existent GPU.'
);

/* ------------------------------------------------------------------ */
/*  Model export                                                      */
/* ------------------------------------------------------------------ */

export default mongoose.model('PC', pcSchema, 'pcs');
