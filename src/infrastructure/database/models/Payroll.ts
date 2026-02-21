import mongoose, { Schema, Document } from "mongoose";

export interface IPayroll extends Document {
  companyId: mongoose.Types.ObjectId;
  periodMonth: number; // 1-12
  periodYear: number;
  totalGross: mongoose.Types.Decimal128;
  totalNett: mongoose.Types.Decimal128;
  totalTax: mongoose.Types.Decimal128;
  totalBpjs: mongoose.Types.Decimal128;
  status: "DRAFT" | "PROCESSED" | "PAID";
  journalId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PayrollSchema = new Schema<IPayroll>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    periodMonth: { type: Number, required: true, min: 1, max: 12 },
    periodYear: { type: Number, required: true },
    totalGross: { type: mongoose.Schema.Types.Decimal128, required: true },
    totalNett: { type: mongoose.Schema.Types.Decimal128, required: true },
    totalTax: { type: mongoose.Schema.Types.Decimal128, required: true },
    totalBpjs: { type: mongoose.Schema.Types.Decimal128, required: true },
    status: { type: String, enum: ["DRAFT", "PROCESSED", "PAID"], default: "DRAFT" },
    journalId: { type: Schema.Types.ObjectId, ref: "JournalEntry" }, // Linked auto-journal once PAID
  },
  { timestamps: true }
);

// Indexes to prevent duplicate payroll periods for the same company
PayrollSchema.index({ companyId: 1, periodMonth: 1, periodYear: 1 }, { unique: true });

export const PayrollModel = mongoose.models.Payroll || mongoose.model<IPayroll>("Payroll", PayrollSchema);
