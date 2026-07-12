import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/* ------------------------------------------------------------------ */
/*  GET / — List all users (admin only)                               */
/* ------------------------------------------------------------------ */

router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().lean();
    const userList = users.map(user => ({
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
    }));
    res.json({ success: true, data: userList });
  } catch (err) {
    console.error('[users] GET / error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  PUT /:userId/role — Change user role (admin only)                  */
/* ------------------------------------------------------------------ */

router.put('/:userId/role', authMiddleware, requireAdmin, async (req, res) => {
  try {
    /* Validate ObjectId format early */
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
      });
    }

    /* Validate role body field */
    const { role } = req.body;
    if (role !== 'admin' && role !== 'user') {
      return res.status(400).json({
        success: false,
        message: 'Role must be either "admin" or "user".',
      });
    }

    /* Update user and return fresh profile (password excluded by schema) */
    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      { role },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.json({ success: true, data: updatedUser });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
      });
    }
    console.error('[users] PUT /:userId/role error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
