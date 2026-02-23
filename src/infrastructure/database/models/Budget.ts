import mongoose, { Schema, Document } from "mongoose";

export interface IBudgetLine {
  accountId: mongoose.Types.ObjectId;
  accountCode?: string;
  accountName?: string;
  amount: mongoose.Types.Decimal128;
  notes?: string;
}

export interface IBudget extends Document {
  companyId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  fiscalYear: number;
  periodType: "ANNUAL" | "QUARTERLY" | "MONTHLY";
  periodNumber?: number; // 1-4 for quarterly, 1-12 for monthly, null for annual
  departmentId?: mongoose.Types.ObjectId;
  costCenterId?: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  lines: IBudgetLine[];
  totalAmount: mongoose.Types.Decimal128;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "ACTIVE" | "CLOSED";
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BudgetLineSchema = new Schema<IBudgetLine>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "ChartOfAccount", required: true },
    accountCode: { type: String },
    accountName: { type: String },
    amount: { type: mongoose.Schema.Types.Decimal128, required: true },
    notes: { type: String },
  },
  { _id: false }
);

const BudgetSchema = new Schema<IBudget>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    fiscalYear: { type: Number, required: true },
    periodType: { 
      type: String, 
      enum: ["ANNUAL", "QUARTERLY", "MONTHLY"], 
      required: true 
    },
    periodNumber: { type: Number }, // 1-4 for QUARTERLY, 1-12 for MONTHLY
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    costCenterId: { type: Schema.Types.ObjectId, ref: "CostCenter" },
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    lines: { type: [BudgetLineSchema], default: [] },
    totalAmount: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    status: { 
      type: String, 
      enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "ACTIVE", "CLOSED"], 
      default: "DRAFT" 
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

BudgetSchema.index({ companyId: 1, fiscalYear: 1, periodType: 1, periodNumber: 1 });
BudgetSchema.index({ companyId: 1, status: 1 });
BudgetSchema.index({ companyId: 1, departmentId: 1 });

export const BudgetModel = mongoose.models.Budget || mongoose.model<IBudget>("Budget", BudgetSchema);
