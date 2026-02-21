import mongoose, { Schema, Document } from "mongoose";

export interface IJournalLine {
  accountId: mongoose.Types.ObjectId;
  debit: mongoose.Types.Decimal128;
  credit: mongoose.Types.Decimal128;
  description?: string;
}

export interface IJournalEntry extends Document {
  companyId: mongoose.Types.ObjectId;
  journalNo: string;
  date: Date;
  description: string;
  source: "MANUAL" | "PAYROLL" | "REVENUE" | "EXPENSE" | "TAX";
  status: "DRAFT" | "POSTED" | "VOID";
  lines: IJournalLine[];
  createdBy: mongoose.Types.ObjectId;
}

const JournalLineSchema = new Schema<IJournalLine>({
  accountId: { type: Schema.Types.ObjectId, ref: "ChartOfAccount", required: true },
  debit: { type: mongoose.Schema.Types.Decimal128, required: true, default: 0 },
  credit: { type: mongoose.Schema.Types.Decimal128, required: true, default: 0 },
  description: { type: String },
});

const JournalEntrySchema = new Schema<IJournalEntry>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    journalNo: { type: String, required: true },
    date: { type: Date, required: true, index: true },
    description: { type: String, required: true },
    source: { type: String, enum: ["MANUAL", "PAYROLL", "REVENUE", "EXPENSE", "TAX"], required: true },
    status: { type: String, enum: ["DRAFT", "POSTED", "VOID"], default: "DRAFT", index: true },
    lines: [JournalLineSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

JournalEntrySchema.index({ companyId: 1, journalNo: 1 }, { unique: true });

export const JournalEntryModel = mongoose.models.JournalEntry || mongoose.model<IJournalEntry>("JournalEntry", JournalEntrySchema);
