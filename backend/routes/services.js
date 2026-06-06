import express from 'express';
import PC from '../models/PC.js';
import { validateServiceBody, validateServiceUpdate } from '../middleware/validation.js';

const router = express.Router();

/* ------------------------------------------------------------------ */
/*  Helper: extract pcId from req.baseUrl (Express strips the mount     */
/*  prefix including :pcId params when a sub-router is involved)       */
/*  E.g. req.baseUrl === '/api/pcs/:pcId/services' at runtime          */
/* ------------------------------------------------------------------ */

function getPcId(req) {
  // req.baseUrl at mount point: /api/pcs/<id>/services
  const parts = req.baseUrl.match(/\/api\/pcs\/([^/]+)/);
  return parts ? parts[1] : req.params.pcid;
}

/* ------------------------------------------------------------------ */
/*  GET / — List services for a given PC                              */
/* ------------------------------------------------------------------ */

router.get('/', async (req, res) => {
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
    console.error('[services] GET / error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  POST / — Add a service to a PC                                    */
/* ------------------------------------------------------------------ */

router.post('/', validateServiceBody, async (req, res) => {
  try {
    const pc = await PC.findById(getPcId(req));
    console.log('[SVC POST] pc found=', !!pc, 'pc._id=', pc?._id?.toString());
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
    console.error('[services] POST / error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  PUT /:serviceIndex — Update a service by its array index          */
/* ------------------------------------------------------------------ */

router.put('/:serviceIndex', validateServiceUpdate, async (req, res) => {
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
    console.error('[services] PUT /:serviceIndex error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  DELETE /:serviceIndex — Remove a service by its array index       */
/* ------------------------------------------------------------------ */

router.delete('/:serviceIndex', async (req, res) => {
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
    console.error('[services] DELETE /:serviceIndex error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
