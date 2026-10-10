import express from 'express';
import DNS, { GLOBAL_DNS_ID } from '../models/DNS.js';
import { validateDnsEntry, validateDnsEntryUpdate } from '../middleware/validation.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import { auditLogger } from '../middleware/auditLogger.js';
import logger from '../utils/logger.js';
import { sanitizeMiddleware } from '../middleware/sanitization.js';

const router = express.Router();

/* ------------------------------------------------------------------ */
/*  GET / — Get the global DNS card (synthetic if the doc is missing)  */
/* ------------------------------------------------------------------ */

router.get('/', authMiddleware, async (req, res) => {
  try {
    const doc = await DNS.findById(GLOBAL_DNS_ID);
    if (!doc) {
      // The DNS card "always exists" — return a synthetic empty card.
      return res.json({ success: true, data: { _id: GLOBAL_DNS_ID, entries: [] } });
    }
    res.json({ success: true, data: doc });
  } catch (err) {
    logger.error('[dns] GET / error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /entries — Create a new DNS entry                             */
/* ------------------------------------------------------------------ */

router.post(
  '/entries',
  authMiddleware,
  requireAdmin,
  sanitizeMiddleware,
  validateDnsEntry,
  auditLogger('DNS_ENTRY_CREATE'),
  async (req, res) => {
    try {
      let doc = await DNS.findById(GLOBAL_DNS_ID);
      if (!doc) {
        doc = await DNS.create({ _id: GLOBAL_DNS_ID, entries: [] });
      }

      // validateDnsEntry already applied defaults to req.body, so it is
      // safe to push the body directly as a new entry subdocument.
      doc.entries.push(req.body);
      await doc.save();

      const newEntry = doc.entries[doc.entries.length - 1];
      req.auditMetadata = { entryId: newEntry._id, name: req.body.name, host: req.body.host };
      res.status(201).json({ success: true, data: doc });
    } catch (err) {
      if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ success: false, errors: messages });
      }
      logger.error('[dns] POST /entries error:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

/* ------------------------------------------------------------------ */
/*  PUT /entries/:entryId — Update an existing DNS entry               */
/* ------------------------------------------------------------------ */

router.put(
  '/entries/:entryId',
  authMiddleware,
  requireAdmin,
  sanitizeMiddleware,
  validateDnsEntryUpdate,
  auditLogger('DNS_ENTRY_UPDATE'),
  async (req, res) => {
    try {
      const doc = await DNS.findById(GLOBAL_DNS_ID);
      if (!doc) {
        return res.status(404).json({ success: false, message: 'DNS card not found' });
      }

      const entry = doc.entries.find(e => e._id.toString() === req.params.entryId);
      if (!entry) {
        return res.status(404).json({ success: false, message: 'DNS entry not found' });
      }

      // Merge only the fields actually present in the request body.
      if (req.body.name !== undefined) entry.name = req.body.name;
      if (req.body.host !== undefined) entry.host = req.body.host;
      if (req.body.port !== undefined) entry.port = req.body.port;
      if (req.body.probeDomain !== undefined) entry.probeDomain = req.body.probeDomain;
      if (req.body.type !== undefined) entry.type = req.body.type;

      await doc.save();

      req.auditMetadata = {
        entryId: entry._id,
        name: entry.name,
        host: entry.host,
      };
      res.json({ success: true, data: entry });
    } catch (err) {
      if (err.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid entry ID format.' });
      }
      if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ success: false, errors: messages });
      }
      logger.error('[dns] PUT /entries/:entryId error:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

/* ------------------------------------------------------------------ */
/*  DELETE /entries/:entryId — Remove a DNS entry                      */
/* ------------------------------------------------------------------ */

router.delete(
  '/entries/:entryId',
  authMiddleware,
  requireAdmin,
  auditLogger('DNS_ENTRY_DELETE'),
  async (req, res) => {
    try {
      const doc = await DNS.findById(GLOBAL_DNS_ID);
      if (!doc) {
        return res.status(404).json({ success: false, message: 'DNS card not found' });
      }

      const idx = doc.entries.findIndex(e => e._id.toString() === req.params.entryId);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'DNS entry not found' });
      }

      doc.entries.splice(idx, 1);
      await doc.save();

      req.auditMetadata = { entryId: req.params.entryId };
      res.json({ success: true, message: 'DNS entry deleted', data: { entryId: req.params.entryId } });
    } catch (err) {
      if (err.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid entry ID format.' });
      }
      logger.error('[dns] DELETE /entries/:entryId error:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

export default router;
