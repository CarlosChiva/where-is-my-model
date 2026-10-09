import mongoose from 'mongoose';

/* ------------------------------------------------------------------ */
/*  Global DNS card identifier                                          */
/* ------------------------------------------------------------------ */

export const GLOBAL_DNS_ID = 'global';

/* ------------------------------------------------------------------ */
/*  Entry subdocument schema                                            */
/*  Each entry gets its own _id (Mongoose default — do NOT disable).    */
/* ------------------------------------------------------------------ */

const entrySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Entry name is required.'],
      trim: true,
    },
    host: {
      type: String,
      required: [true, 'Host is required.'],
      trim: true,
    },
    port: {
      type: Number,
      default: 53,
    },
    probeDomain: {
      type: String,
      default: 'example.com',
    },
    type: {
      type: String,
      enum: ['A', 'AAAA'],
      default: 'A',
    },
  }
  /* No options — Mongoose adds _id by default (decision 5). */
);

/* ------------------------------------------------------------------ */
/*  DNS schema — single global card                                     */
/* ------------------------------------------------------------------ */

const dnsSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
    },
    entries: {
      type: [entrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ------------------------------------------------------------------ */
/*  Model export                                                       */
/* ------------------------------------------------------------------ */

export default mongoose.model('DNS', dnsSchema, 'dns');
