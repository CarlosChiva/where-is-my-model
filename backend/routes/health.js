import express from 'express';
import { isValidObjectId } from 'mongoose';
import PC from '../models/PC.js';
import { checkPcServices, checkAllServices } from '../services/healthChecker.js';
import { authMiddleware } from '../middleware/auth.js';
import { healthLimiter } from '../middleware/rateLimit.js';

const router = express.Router();
router.use(healthLimiter);

/* ------------------------------------------------------------------ */
/*  POST /pcs/:pcId — Health-check services on a single PC             */
/* ------------------------------------------------------------------ */

router.post('/pcs/:pcId', authMiddleware, async (req, res) => {
  try {
    const pcId = req.params.pcId;

    /* Reject non-ObjectIds before hitting the database               */
    if (!isValidObjectId(pcId)) {
      return res.status(400).json({ success: false, message: 'Invalid PC ID' });
    }

    const pc = await PC.findById(pcId);
    if (!pc) {
      return res.status(404).json({ success: false, message: 'PC not found' });
    }

    const result = await checkPcServices(pc);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid PC ID' });
    }
    console.error('[health] POST /pcs/:pcId error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /all — Health-check services across the entire fleet          */
/* ------------------------------------------------------------------ */

router.post('/all', authMiddleware, async (req, res) => {
  try {
    const pcs = await PC.find();
    const results = await checkAllServices(pcs);
    res.json({ success: true, data: results });
  } catch (err) {
    console.error('[health] POST /all error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
