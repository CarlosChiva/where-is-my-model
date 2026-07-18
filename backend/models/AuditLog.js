import mongoose from 'mongoose';

/* ------------------------------------------------------------------ */
/*  Action enum values                                                 */
/* ------------------------------------------------------------------ */

const AUDIT_ACTIONS = [
  'USER_LOGIN',
  'USER_LOGOUT',
  'USER_REGISTER',
  'USER_ROLE_CHANGE',
  'USER_DELETE',
  'PC_CREATE',
  'PC_UPDATE',
  'PC_DELETE',
  'SERVICE_UPDATE',
  'SERVICE_CREATE',
  'SERVICE_DELETE',
  'HEALTH_CHECK',
  'FAILED_LOGIN',
  'TOKEN_REFRESH',
  'TWO_FACTOR_ENABLE',
  'TWO_FACTOR_DISABLE',
];

/* ------------------------------------------------------------------ */
/*  AuditLog schema                                                    */
/* ------------------------------------------------------------------ */

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: AUDIT_ACTIONS,
      required: [true, 'Action is required.'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    username: {
      type: String,
      required: [true, 'Username is required for readability.'],
    },
    ipAddress: {
      type: String,
      required: [true, 'IP address is required.'],
    },
    userAgent: {
      type: String,
      default: '',
    },
    requestId: {
      type: String,
      required: [true, 'Request ID is required for trace correlation.'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/* ------------------------------------------------------------------ */
/*  Compound index for query performance                               */
/* ------------------------------------------------------------------ */

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

/* ------------------------------------------------------------------ */
/*  Static helper: create-and-log in one call                          */
/* ------------------------------------------------------------------ */

auditLogSchema.statics.record = async function (payload, session) {
  const options = session ? { session } : {};
  return this.create([payload], options);
};

/* ------------------------------------------------------------------ */
/*  Model export                                                       */
/* ------------------------------------------------------------------ */

export default mongoose.model('AuditLog', auditLogSchema, 'auditLogs');
export { AUDIT_ACTIONS };
