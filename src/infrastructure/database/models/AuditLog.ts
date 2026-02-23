import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  companyId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  action: string;
  module: string;
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true },
    module: { type: String, required: true },
    resourceId: { type: String },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Compound indexes for common query patterns
AuditLogSchema.index({ companyId: 1, module: 1 });
AuditLogSchema.index({ companyId: 1, action: 1 });
AuditLogSchema.index({ companyId: 1, resourceId: 1 });
AuditLogSchema.index({ companyId: 1, createdAt: -1 });
// TTL index to auto-delete old audit logs after 2 years (optional, can be adjusted)
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });

export const AuditLogModel = mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
