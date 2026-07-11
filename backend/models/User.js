import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const SALT_ROUNDS = 10;

/* ------------------------------------------------------------------ */
/*  User schema                                                       */
/* ------------------------------------------------------------------ */

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required.'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters long.'],
      maxlength: [64, 'Username must not exceed 64 characters.'],
    },
    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: [8, 'Password must be at least 8 characters long.'],
      select: false, // Exclude from queries by default
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ------------------------------------------------------------------ */
/*  Pre-save hook: hash password before persisting                    */
/*  Only hashes if the `password` field is newly set or modified.      */
/* ------------------------------------------------------------------ */

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcryptjs.genSalt(SALT_ROUNDS);
    this.password = await bcryptjs.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ */
/*  Instance method: compare a plain-text password against the hash    */
/* ------------------------------------------------------------------ */

userSchema.methods.comparePassword = function (plainText) {
  return bcryptjs.compare(plainText, this.password);
};

/* ------------------------------------------------------------------ */
/*  Model export                                                      */
/* ------------------------------------------------------------------ */

export default mongoose.model('User', userSchema, 'users');
