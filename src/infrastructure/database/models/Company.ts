import mongoose, { Schema, Document } from "mongoose";

export interface ICompany extends Document {
  name: string;
  npwp: string;
  address: string;
  timezone: string;
  currency: string;
  logoUrl?: string;
  industry?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true },
    npwp: { type: String, required: true },
    address: { type: String },
    timezone: { type: String, default: "Asia/Jakarta" },
    currency: { type: String, default: "IDR" },
    logoUrl: { type: String },
    industry: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const CompanyModel = mongoose.models.Company || mongoose.model<ICompany>("Company", CompanySchema);
