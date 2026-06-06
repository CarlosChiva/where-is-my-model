import express from 'express';
import PC from '../models/PC.js';
import { validatePcBody } from '../middleware/validation.js';

const router = express.Router();

/* ------------------------------------------------------------------ */
/*  GET / — List all PCs                                              */
/* ------------------------------------------------------------------ */

router.get('/', async (req, res) => {
  try {
    const pcs = await PC.find().lean();
    res.json({ success: true, data: pcs });
  } catch (err) {
    console.error('[pcs] GET / error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /:id — Get single PC                                          */
/* ------------------------------------------------------------------ */

router.get('/:id', async (req, res) => {
  try {
    const pc = await PC.findById(req.params.id).lean();
    if (!pc) {
      return res.status(404).json({ success: false, message: 'PC not found' });
    }
    res.json({ success: true, data: pc });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid PC ID format.' });
    }
    console.error('[pcs] GET /:id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  POST / — Create new PC                                            */
/* ------------------------------------------------------------------ */

router.post('/', validatePcBody, async (req, res) => {
  try {
    const pc = new PC({
      nombre: req.body.nombre,
      ip: req.body.ip,
      gpus: req.body.gpus,
      // servicios defaults to [] via schema definition — no explicit set needed
    });

    const savedPc = await pc.save();
    res.status(201).json({ success: true, data: savedPc });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, errors: messages });
    }
    console.error('[pcs] POST / error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  PUT /:id — Update existing PC                                     */
/* ------------------------------------------------------------------ */

router.put('/:id', validatePcBody, async (req, res) => {
  try {
    const pc = await PC.findByIdAndUpdate(
      req.params.id,
      {
        nombre: req.body.nombre,
        ip: req.body.ip,
        gpus: req.body.gpus,
      },
      { new: true, runValidators: true }
    );

    if (!pc) {
      return res.status(404).json({ success: false, message: 'PC not found' });
    }
    res.json({ success: true, data: pc });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid PC ID format.' });
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, errors: messages });
    }
    console.error('[pcs] PUT /:id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  DELETE /:id — Remove PC and all its services                      */
/* ------------------------------------------------------------------ */

router.delete('/:id', async (req, res) => {
  try {
    const pc = await PC.findByIdAndDelete(req.params.id);

    if (!pc) {
      return res.status(404).json({ success: false, message: 'PC not found' });
    }
    // Deleting the parent document cascades to all embedded servicios automatically.
    res.json({ success: true, data: pc, message: 'PC deleted successfully' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid PC ID format.' });
    }
    console.error('[pcs] DELETE /:id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
