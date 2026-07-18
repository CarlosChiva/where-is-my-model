import express from 'express';
import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';
import logger from '../utils/logger.js';

/* ------------------------------------------------------------------ */
/*  All audit-log endpoints are admin-only by design.                 */
/* ------------------------------------------------------------------ */

const router = express.Router();

/* ------------------------------------------------------------------ */
/*  GET / — Paginated audit log entries with optional filters         */
/*  Query parameters:                                                 */
/*    page     (number, default 1)    — page number                   */
/*    limit    (number, default 20)   — entries per page              */
/*    from     (ISO date string)      — start of date range           */
/*    to       (ISO date string)      — end of date range             */
/*    action   (string)               — filter by action type         */
/*    userId   (ObjectId string)      — filter by user                */
/* ------------------------------------------------------------------ */

router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    /* --- Pagination defaults --------------------------------------- */
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    /* --- Build query filter ---------------------------------------- */
    const filter = {};

    if (req.query.from) {
      filter.timestamp = filter.timestamp || {};
      filter.timestamp.$gte = new Date(req.query.from);
    }
    if (req.query.to) {
      filter.timestamp = filter.timestamp || {};
      filter.timestamp.$lte = new Date(req.query.to);
    }

    if (req.query.action) {
      filter.action = req.query.action;
    }

    if (req.query.userId) {
      /* --- Validate userId is a proper ObjectId -------------------- */
      if (!mongoose.Types.ObjectId.isValid(req.query.userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid userId format.',
        });
      }
      filter.userId = new mongoose.Types.ObjectId(req.query.userId);
    }

    /* --- Parallel find + count ------------------------------------- */
    const [entries, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.json({
      success: true,
      data: {
        entries,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    });
  } catch (err) {
    logger.error('[audit-logs] GET / error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  Router export                                                      */
/* ------------------------------------------------------------------ */

export default router;
