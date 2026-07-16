import mongoose from 'mongoose';

/* ------------------------------------------------------------------ */
/*  RefreshToken schema                                               */
/* ------------------------------------------------------------------ */

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required.'],
      index: true,
    },
    token: {
      type: String,
      required: [true, 'token (JWT string) is required.'],
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'expiresAt is required.'],
      index: true,
    },
    revoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

/* ------------------------------------------------------------------ */
/*  Compound index                                                    */
/* ------------------------------------------------------------------ */

refreshTokenSchema.index({ userId: 1, revoked: 1, expiresAt: -1 });

/* ------------------------------------------------------------------ */
/*  Instance method                                                   */
/* ------------------------------------------------------------------ */

refreshTokenSchema.methods.isValid = function () {
  return !this.revoked && this.expiresAt > new Date();
};

/* ------------------------------------------------------------------ */
/*  Static method                                                     */
/* ------------------------------------------------------------------ */

refreshTokenSchema.statics.findByToken = function (tokenValue) {
  return this.findOne({ token: tokenValue });
};

/* ------------------------------------------------------------------ */
/*  Model export                                                      */
/* ------------------------------------------------------------------ */

export default mongoose.model('RefreshToken', refreshTokenSchema, 'refreshTokens');
