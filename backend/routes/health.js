import express from 'express';
import { isValidObjectId } from 'mongoose';
import PC from '../models/PC.js';
import { checkPcServices, checkAllServices, checkDnsEntry } from '../services/healthChecker.js';
import DNS, { GLOBAL_DNS_ID } from '../models/DNS.js';
import { authMiddleware } from '../middleware/auth.js';
import { healthLimiter } from '../middleware/rateLimit.js';
import logger from '../utils/logger.js';

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
    logger.error('[health] POST /pcs/:pcId error:', err);
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
    logger.error('[health] POST /all error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /dns/:dnsId/:entryId — On-demand check of a single DNS entry  */
/* ------------------------------------------------------------------ */

router.post('/dns/:dnsId/:entryId', authMiddleware, async (req, res) => {
  try {
    if (req.params.dnsId !== GLOBAL_DNS_ID) {
      return res.status(404).json({ success: false, message: 'DNS card not found' });
    }

    if (!isValidObjectId(req.params.entryId)) {
      return res.status(400).json({ success: false, message: 'Invalid DNS entry ID' });
    }

    const card = await DNS.findById(GLOBAL_DNS_ID);
    if (!card) {
      return res.status(404).json({ success: false, message: 'DNS card not found' });
    }

    const entry = card.entries.find((e) => e._id.toString() === req.params.entryId);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'DNS entry not found' });
    }

    const result = await checkDnsEntry({
      host: entry.host,
      port: entry.port,
      probeDomain: entry.probeDomain,
      type: entry.type,
      timeoutMs: 5000,
    });

    res.json({
      success: true,
      data: {
        dnsId: GLOBAL_DNS_ID,
        entryId: entry._id.toString(),
        name: entry.name,
        status: result.status,
        reason: result.reason,
        latencyMs: result.latencyMs,
      },
    });
  } catch (err) {
    logger.error('[health] POST /dns/:dnsId/:entryId error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /dns/:dnsId — On-demand check of ALL DNS entries in parallel  */
/* ------------------------------------------------------------------ */

router.post('/dns/:dnsId', authMiddleware, async (req, res) => {
  try {
    if (req.params.dnsId !== GLOBAL_DNS_ID) {
      return res.status(404).json({ success: false, message: 'DNS card not found' });
    }

    const card = await DNS.findById(GLOBAL_DNS_ID);
    if (!card) {
      return res.status(404).json({ success: false, message: 'DNS card not found' });
    }

    const results = await Promise.allSettled(
      card.entries.map((entry) =>
        checkDnsEntry({
          host: entry.host,
          port: entry.port,
          probeDomain: entry.probeDomain,
          type: entry.type,
          timeoutMs: 5000,
        })
      )
    );

    const entries = results.map((r, i) => {
      if (r.status === 'fulfilled') {
        return {
          entryId: card.entries[i]._id.toString(),
          name: card.entries[i].name,
          status: r.value.status,
          reason: r.value.reason,
          latencyMs: r.value.latencyMs,
        };
      }
      return {
        entryId: card.entries[i]._id.toString(),
        name: card.entries[i].name,
        status: 'down',
        reason: 'error',
        latencyMs: 0,
      };
    });

    res.json({
      success: true,
      data: {
        dnsId: GLOBAL_DNS_ID,
        entries,
      },
    });
  } catch (err) {
    logger.error('[health] POST /dns/:dnsId error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
