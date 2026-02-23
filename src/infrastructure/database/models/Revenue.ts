import mongoose, { Schema, Document } from "mongoose";

export interface IRevenue extends Document {
  companyId: mongoose.Types.ObjectId;
  source: string;
  customer: string;
  invoiceNumber: string;
  amount: mongoose.Types.Decimal128;
  tax: mongoose.Types.Decimal128;
  paymentMethod: "BANK_TRANSFER" | "CASH" | "CREDIT_CARD";
  status: "PAID" | "UNPAID" | "VOID";
  journalId?: mongoose.Types.ObjectId;
  date: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const RevenueSchema = new Schema<IRevenue>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    source: { type: String, required: true },
    customer: { type: String, required: true },
    invoiceNumber: { type: String, required: true },
    amount: { type: mongoose.Schema.Types.Decimal128, required: true },
    tax: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    paymentMethod: { type: String, enum: ["BANK_TRANSFER", "CASH", "CREDIT_CARD"], required: true },
    status: { type: String, enum: ["PAID", "UNPAID", "VOID"], default: "PAID" },
    journalId: { type: Schema.Types.ObjectId, ref: "JournalEntry" }, // Linked auto-journal
    date: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Compound indexes for common query patterns
RevenueSchema.index({ companyId: 1, invoiceNumber: 1 }, { unique: true });
RevenueSchema.index({ companyId: 1, status: 1 });
RevenueSchema.index({ companyId: 1, date: -1 });
RevenueSchema.index({ companyId: 1, customer: 1 });

export const RevenueModel = mongoose.models.Revenue || mongoose.model<IRevenue>("Revenue", RevenueSchema);
