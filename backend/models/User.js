import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const SALT_ROUNDS = 10;

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{12,}$/;

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
      minlength: [12, 'Password must be at least 12 characters long.'],
      validate: {
        validator: function (v) {
          return PASSWORD_REGEX.test(v);
        },
        message: 'Password does not meet complexity requirements.',
      },
      select: false, // Exclude from queries by default
    },
    role: {
      type: String,
      enum: ['admin', 'user', 'pending'],
      default: 'user',
    },
    /* --- 2FA fields (optional) ------------------------------------ */
    totpSecret: {
      type: String,
      sparse: true,   // Only indexed when present — keeps unindexed for non-2FA users
      select: false,  // Never returned in queries by default
    },
    totpEnabled: {
      type: Boolean,
      default: false,
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
