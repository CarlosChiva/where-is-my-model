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
    if (role !== 'admin' && role !== 'user' && role !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Role must be either "admin", "user" or "pending".',
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

/* ------------------------------------------------------------------ */
/*  DELETE /:userId — Delete user (admin only) with last-admin safeguard*/
/* ------------------------------------------------------------------ */

router.delete('/:userId', authMiddleware, requireAdmin, async (req, res) => {
  try {
    /* Validate ObjectId format early */
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
      });
    }

    /* Find the target user */
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    /* Last-admin safeguard: if this is the only admin, promote someone   */
    /* else first. Only promote non-pending users ('user' or 'admin').    */
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount === 1) {
      const candidate = await User.findOne({
        role: { $ne: 'pending' },
        _id: { $ne: req.params.userId },
      });
      if (!candidate) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last admin and no other user is available to promote.',
        });
      }
      candidate.role = 'admin';
      await candidate.save();
    }

    /* Delete the target user */
    await User.findByIdAndDelete(req.params.userId);
    res.status(204).send();
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.',
      });
    }
    console.error('[users] DELETE /:userId error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
