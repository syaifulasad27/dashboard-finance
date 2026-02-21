import mongoose, { Schema, Document } from "mongoose";

export interface IChartOfAccount extends Document {
  companyId: mongoose.Types.ObjectId;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  parentId?: mongoose.Types.ObjectId;
  isActive: boolean;
}

const ChartOfAccountSchema = new Schema<IChartOfAccount>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"], required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: "ChartOfAccount" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ChartOfAccountSchema.index({ companyId: 1, code: 1 }, { unique: true });

export const ChartOfAccountModel = mongoose.models.ChartOfAccount || mongoose.model<IChartOfAccount>("ChartOfAccount", ChartOfAccountSchema);
