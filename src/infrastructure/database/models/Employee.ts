import mongoose, { Schema, Document } from "mongoose";

export interface ISalaryConfig {
  basicSalary: mongoose.Types.Decimal128;
  allowances: Array<{
    name: string;
    amount: mongoose.Types.Decimal128;
  }>;
  deductions: Array<{
    name: string;
    amount: mongoose.Types.Decimal128;
  }>;
  bpjsKesehatan: boolean;
  bpjsKetenagakerjaan: boolean;
  ptkpStatus: string; // e.g. TK/0, K/1
}

export interface IEmployee extends Document {
  companyId: mongoose.Types.ObjectId;
  nik: string;
  name: string;
  email: string;
  npwp?: string;
  bpjsNumber?: string;
  departmentId?: mongoose.Types.ObjectId;
  costCenterId?: mongoose.Types.ObjectId;
  employmentStatus: "PERMANENT" | "CONTRACT" | "PROBATION";
  joinDate: Date;
  salaryConfig: ISalaryConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    nik: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    npwp: { type: String },
    bpjsNumber: { type: String },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    costCenterId: { type: Schema.Types.ObjectId, ref: "CostCenter" },
    employmentStatus: { type: String, enum: ["PERMANENT", "CONTRACT", "PROBATION"], required: true },
    joinDate: { type: Date, required: true },
    salaryConfig: {
      basicSalary: { type: mongoose.Schema.Types.Decimal128, required: true },
      allowances: [
        {
          name: { type: String, required: true },
          amount: { type: mongoose.Schema.Types.Decimal128, required: true },
        }
      ],
      deductions: [
        {
          name: { type: String, required: true },
          amount: { type: mongoose.Schema.Types.Decimal128, required: true },
        }
      ],
      bpjsKesehatan: { type: Boolean, default: true },
      bpjsKetenagakerjaan: { type: Boolean, default: true },
      ptkpStatus: { type: String, default: "TK/0" },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const EmployeeModel = mongoose.models.Employee || mongoose.model<IEmployee>("Employee", EmployeeSchema);
