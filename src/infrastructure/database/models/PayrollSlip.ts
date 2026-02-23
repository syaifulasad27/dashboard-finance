import mongoose, { Schema, Document } from "mongoose";

export interface IPayrollSlip extends Document {
  payrollId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  basicSalary: mongoose.Types.Decimal128;
  allowancesTotal: mongoose.Types.Decimal128;
  deductionsTotal: mongoose.Types.Decimal128;
  bpjsKesehatanAmount: mongoose.Types.Decimal128;
  bpjsKetenagakerjaanAmount: mongoose.Types.Decimal128;
  pph21Amount: mongoose.Types.Decimal128;
  netSalary: mongoose.Types.Decimal128;
  createdAt: Date;
}

const PayrollSlipSchema = new Schema<IPayrollSlip>(
  {
    payrollId: { type: Schema.Types.ObjectId, ref: "Payroll", required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    basicSalary: { type: mongoose.Schema.Types.Decimal128, required: true },
    allowancesTotal: { type: mongoose.Schema.Types.Decimal128, required: true },
    deductionsTotal: { type: mongoose.Schema.Types.Decimal128, required: true },
    bpjsKesehatanAmount: { type: mongoose.Schema.Types.Decimal128, required: true },
    bpjsKetenagakerjaanAmount: { type: mongoose.Schema.Types.Decimal128, required: true },
    pph21Amount: { type: mongoose.Schema.Types.Decimal128, required: true },
    netSalary: { type: mongoose.Schema.Types.Decimal128, required: true },
  },
  { timestamps: true }
);

// Compound indexes for common query patterns
PayrollSlipSchema.index({ payrollId: 1, employeeId: 1 }, { unique: true });
PayrollSlipSchema.index({ employeeId: 1 });

export const PayrollSlipModel = mongoose.models.PayrollSlip || mongoose.model<IPayrollSlip>("PayrollSlip", PayrollSlipSchema);
