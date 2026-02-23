import mongoose, { Schema, Document } from "mongoose";

export interface IDepartment extends Document {
  companyId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  managerId?: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    managerId: { type: Schema.Types.ObjectId, ref: "Employee" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound indexes for common query patterns
DepartmentSchema.index({ companyId: 1, name: 1 }, { unique: true });
DepartmentSchema.index({ companyId: 1, isActive: 1 });

export const DepartmentModel = mongoose.models.Department || mongoose.model<IDepartment>("Department", DepartmentSchema);
