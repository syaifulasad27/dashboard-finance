import mongoose, { Schema, Document } from "mongoose";

export interface IProject extends Document {
  companyId: mongoose.Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  departmentId?: mongoose.Types.ObjectId;
  costCenterId?: mongoose.Types.ObjectId;
  managerId?: mongoose.Types.ObjectId;
  startDate?: Date;
  endDate?: Date;
  budget?: mongoose.Types.Decimal128;
  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    costCenterId: { type: Schema.Types.ObjectId, ref: "CostCenter" },
    managerId: { type: Schema.Types.ObjectId, ref: "Employee" },
    startDate: { type: Date },
    endDate: { type: Date },
    budget: { type: mongoose.Schema.Types.Decimal128 },
    status: { 
      type: String, 
      enum: ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"],
      default: "PLANNING" 
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

ProjectSchema.index({ companyId: 1, code: 1 }, { unique: true });
ProjectSchema.index({ companyId: 1, status: 1 });
ProjectSchema.index({ companyId: 1, departmentId: 1 });

export const ProjectModel = mongoose.models.Project || mongoose.model<IProject>("Project", ProjectSchema);
