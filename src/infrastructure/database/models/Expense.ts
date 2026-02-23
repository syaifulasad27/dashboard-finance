import mongoose, { Schema, Document } from "mongoose";

export interface IExpense extends Document {
  companyId: mongoose.Types.ObjectId;
  vendor: string;
  category: string;
  amount: mongoose.Types.Decimal128;
  tax: mongoose.Types.Decimal128;
  attachment?: string;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  journalId?: mongoose.Types.ObjectId;
  date: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    vendor: { type: String, required: true },
    category: { type: String, required: true },
    amount: { type: mongoose.Schema.Types.Decimal128, required: true },
    tax: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    attachment: { type: String }, // URL to uploaded file
    approvalStatus: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
    journalId: { type: Schema.Types.ObjectId, ref: "JournalEntry" }, // Linked auto-journal once approved
    date: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Compound indexes for common query patterns
ExpenseSchema.index({ companyId: 1, approvalStatus: 1 });
ExpenseSchema.index({ companyId: 1, date: -1 });
ExpenseSchema.index({ companyId: 1, category: 1 });
ExpenseSchema.index({ companyId: 1, createdBy: 1 });

export const ExpenseModel = mongoose.models.Expense || mongoose.model<IExpense>("Expense", ExpenseSchema);
