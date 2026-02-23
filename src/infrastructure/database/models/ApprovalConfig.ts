import mongoose, { Schema, Document } from "mongoose";

export interface IApprovalStep {
  order: number;
  role: string;
  approverId?: mongoose.Types.ObjectId; // Specific user, or null for any user with role
  description?: string;
}

export interface IApprovalConfig extends Document {
  companyId: mongoose.Types.ObjectId;
  resourceType: "EXPENSE" | "REVENUE" | "JOURNAL" | "PAYROLL";
  name: string;
  description?: string;
  steps: IApprovalStep[];
  amountThreshold?: number; // Only require approval above this amount
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ApprovalStepSchema = new Schema<IApprovalStep>(
  {
    order: { type: Number, required: true },
    role: { type: String, required: true },
    approverId: { type: Schema.Types.ObjectId, ref: "User" },
    description: { type: String },
  },
  { _id: false }
);

const ApprovalConfigSchema = new Schema<IApprovalConfig>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    resourceType: { 
      type: String, 
      enum: ["EXPENSE", "REVENUE", "JOURNAL", "PAYROLL"], 
      required: true 
    },
    name: { type: String, required: true },
    description: { type: String },
    steps: { type: [ApprovalStepSchema], required: true, validate: (v: IApprovalStep[]) => v.length > 0 },
    amountThreshold: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ApprovalConfigSchema.index({ companyId: 1, resourceType: 1 });

export const ApprovalConfigModel = mongoose.models.ApprovalConfig || 
  mongoose.model<IApprovalConfig>("ApprovalConfig", ApprovalConfigSchema);
