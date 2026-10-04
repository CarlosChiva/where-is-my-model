import express from 'express';
import PC from '../models/PC.js';
import { validateServiceBody, validateServiceUpdate } from '../middleware/validation.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import { sanitizeMiddleware } from '../middleware/sanitization.js';

// `mergeParams: true` is required: the router is mounted at
// `${API_PREFIX}/pcs/:pcId/services` (see server.js), and Express 4 sub-routers
// do NOT merge the mount's `:pcId` param into req.params by default. With
// mergeParams enabled, the mount param is merged so `req.params.pcId` is
// available in every route below.
const router = express.Router({ mergeParams: true });

/* ------------------------------------------------------------------ */
/*  Helper: extract pcId from req.params. Because the router is created*/
/*  with `mergeParams: true` (see above), the mount's `:pcId` param is */
/*  merged into req.params inside this router. req.baseUrl at runtime */
/*  is /api/v1/pcs/<id>/services.                                     */
/* ------------------------------------------------------------------ */

function getPcId(req) {
  // mergeParams:true merges the mount's :pcId param into req.params.
  return req.params.pcId;
}

/* ------------------------------------------------------------------ */
/*  GET / — List services for a given PC                              */
/* ------------------------------------------------------------------ */

router.get('/', authMiddleware, async (req, res) => {
  try {
    const pc = await PC.findById(getPcId(req));
    if (!pc) {
      return res.status(404).json({ success: false, message: 'PC not found' });
    }
    res.json({ success: true, data: pc.servicios });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid PC ID format.' });
    }
    logger.error('[services] GET / error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  POST / — Add a service to a PC                                    */
/* ------------------------------------------------------------------ */

router.post('/', authMiddleware, requireAdmin, sanitizeMiddleware, validateServiceBody, async (req, res) => {
  try {
    const pc = await PC.findById(getPcId(req));
    logger.info('[SVC POST] pc found=%s, pc._id=%s', !!pc, pc?._id?.toString());
    if (!pc) {
      return res.status(404).json({ success: false, message: 'PC not found' });
    }

    pc.servicios.push({
      nombre: req.body.nombre,
      puerto: req.body.puerto,
      gpu: req.body.gpu,
      assignedGpu: req.body.assignedGpu,
    });

    // Calling .save() triggers the document-level validator on path('servicios')
    // which enforces sum(servicios[].gpu) <= pc.vram. If the cap is exceeded,
    // Mongoose throws a ValidationError caught below.
    await pc.save();
    res.status(201).json({ success: true, data: pc });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid PC ID format.' });
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, errors: messages });
    }
    logger.error('[services] POST / error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  PUT /:serviceIndex — Update a service by its array index          */
/* ------------------------------------------------------------------ */

router.put('/:serviceIndex', authMiddleware, requireAdmin, sanitizeMiddleware, validateServiceUpdate, async (req, res) => {
  try {
    const pc = await PC.findById(getPcId(req));
    if (!pc) {
      return res.status(404).json({ success: false, message: 'PC not found' });
    }

    const index = parseInt(req.params.serviceIndex, 10);
    if (isNaN(index) || index < 0 || index >= pc.servicios.length) {
      return res
        .status(404)
        .json({ success: false, message: 'Service index out of bounds' });
    }

    // Partial update: only modify fields explicitly sent in the body.
    // This prevents accidentally zeroing out unprovided fields.
    const service = pc.servicios[index];
    if (req.body.nombre !== undefined) {
      service.nombre = req.body.nombre;
    }
    if (req.body.puerto !== undefined) {
      service.puerto = req.body.puerto;
    }
    if (req.body.gpu !== undefined) {
      service.gpu = req.body.gpu;
    }
    if (req.body.assignedGpu !== undefined) {
      service.assignedGpu = req.body.assignedGpu;
    }

    await pc.save(); // GPU cap validator runs here
    res.json({ success: true, data: pc });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid PC ID format.' });
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, errors: messages });
    }
    logger.error('[services] PUT /:serviceIndex error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  DELETE /:serviceIndex — Remove a service by its array index       */
/* ------------------------------------------------------------------ */

router.delete('/:serviceIndex', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const pc = await PC.findById(getPcId(req));
    if (!pc) {
      return res.status(404).json({ success: false, message: 'PC not found' });
    }

    const index = parseInt(req.params.serviceIndex, 10);
    if (isNaN(index) || index < 0 || index >= pc.servicios.length) {
      return res
        .status(404)
        .json({ success: false, message: 'Service index out of bounds' });
    }

    pc.servicios.splice(index, 1);

    // Removing a service only decreases GPU usage, so the cap cannot be
    // violated. save() is still needed to persist the change.
    await pc.save();
    res.json({
      success: true,
      data: pc,
      message: 'Service deleted successfully',
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid PC ID format.' });
    }
    logger.error('[services] DELETE /:serviceIndex error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
