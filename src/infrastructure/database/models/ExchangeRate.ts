import mongoose, { Schema, Document } from "mongoose";

export interface IExchangeRate extends Document {
  companyId: mongoose.Types.ObjectId;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: Date;
  source?: string; // e.g., "MANUAL", "BI", "REUTERS"
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExchangeRateSchema = new Schema<IExchangeRate>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    fromCurrency: { type: String, required: true, maxlength: 3 },
    toCurrency: { type: String, required: true, maxlength: 3 },
    rate: { type: Number, required: true },
    effectiveDate: { type: Date, required: true },
    source: { type: String, default: "MANUAL" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Index for efficient rate lookups
ExchangeRateSchema.index({ companyId: 1, fromCurrency: 1, toCurrency: 1, effectiveDate: -1 });

export const ExchangeRateModel = mongoose.models.ExchangeRate || 
  mongoose.model<IExchangeRate>("ExchangeRate", ExchangeRateSchema);
