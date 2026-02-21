import mongoose, { Schema, Document } from "mongoose";

export interface ICostCenter extends Document {
  companyId: mongoose.Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CostCenterSchema = new Schema<ICostCenter>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CostCenterSchema.index({ companyId: 1, code: 1 }, { unique: true });

export const CostCenterModel = mongoose.models.CostCenter || mongoose.model<ICostCenter>("CostCenter", CostCenterSchema);
