import mongoose, { Schema, Document } from "mongoose";

export interface IApprovalHistory {
  step: number;
  action: "APPROVED" | "REJECTED";
  userId: mongoose.Types.ObjectId;
  userName: string;
  comment?: string;
  timestamp: Date;
}

export interface IApprovalRequest extends Document {
  companyId: mongoose.Types.ObjectId;
  configId: mongoose.Types.ObjectId;
  resourceType: "EXPENSE" | "REVENUE" | "JOURNAL" | "PAYROLL";
  resourceId: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId;
  currentStep: number;
  totalSteps: number;
  status: "PENDING" | "IN_PROGRESS" | "APPROVED" | "REJECTED" | "CANCELLED";
  history: IApprovalHistory[];
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApprovalHistorySchema = new Schema<IApprovalHistory>(
  {
    step: { type: Number, required: true },
    action: { type: String, enum: ["APPROVED", "REJECTED"], required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    comment: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ApprovalRequestSchema = new Schema<IApprovalRequest>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    configId: { type: Schema.Types.ObjectId, ref: "ApprovalConfig", required: true },
    resourceType: { 
      type: String, 
      enum: ["EXPENSE", "REVENUE", "JOURNAL", "PAYROLL"], 
      required: true 
    },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    currentStep: { type: Number, default: 1 },
    totalSteps: { type: Number, required: true },
    status: { 
      type: String, 
      enum: ["PENDING", "IN_PROGRESS", "APPROVED", "REJECTED", "CANCELLED"], 
      default: "PENDING" 
    },
    history: { type: [ApprovalHistorySchema], default: [] },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

ApprovalRequestSchema.index({ companyId: 1, status: 1 });
ApprovalRequestSchema.index({ resourceType: 1, resourceId: 1 });
ApprovalRequestSchema.index({ requestedBy: 1 });

export const ApprovalRequestModel = mongoose.models.ApprovalRequest || 
  mongoose.model<IApprovalRequest>("ApprovalRequest", ApprovalRequestSchema);
