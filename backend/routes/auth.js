import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

/* ------------------------------------------------------------------ */
/*  Helper: sign a JWT for the authenticated user                     */
/* ------------------------------------------------------------------ */

function signToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
}

/* ------------------------------------------------------------------ */
/*  Helper: build the safe user profile object (no password)           */
/* ------------------------------------------------------------------ */

function userProfile(user) {
  return {
    userId: user._id.toString(),
    username: user.username,
    role: user.role,
  };
}

/* ------------------------------------------------------------------ */
/*  POST /register — Create a new account                             */
/* ------------------------------------------------------------------ */

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    /* --- Validate presence and type -------------------------------- */
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Username is required.',
      });
    }

    if (!password || typeof password !== 'string' || password.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Password is required.',
      });
    }

    /* --- Check for duplicate username --------------------------------*/
    const existingUser = await User.findOne({ username: username.trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Username already exists.',
      });
    }

    /* --- First-user-is-admin logic ----------------------------------*/
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'admin' : 'user';

    /* --- Create user (pre-save hook hashes password) -----------------*/
    const newUser = new User({
      username: username.trim(),
      password,
      role,
    });
    await newUser.save();

    /* --- Sign token and respond — 201 --------------------------------*/
    const token = signToken(newUser);
    res.status(201).json({
      success: true,
      token,
      user: userProfile(newUser),
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, errors: messages });
    }
    console.error('[auth] POST /register error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /login — Authenticate and return a JWT                       */
/* ------------------------------------------------------------------ */

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Username is required.',
      });
    }

    if (!password || typeof password !== 'string' || password.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Password is required.',
      });
    }

    /* --- Find user (must include the excluded password field) ----------*/
    const user = await User.findOne({ username: username.trim() }).select('+password');

    /* --- Verify credentials ----------------------------------------- */
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    /* --- Sign token and respond — 200 ---------------------------------*/
    const token = signToken(user);
    res.json({
      success: true,
      token,
      user: userProfile(user),
    });
  } catch (err) {
    console.error('[auth] POST /login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /me — Return the authenticated user's profile                 */
/* ------------------------------------------------------------------ */

router.get('/me', authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

export default router;
