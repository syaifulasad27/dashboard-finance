"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/page-session";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { DepartmentModel } from "@/infrastructure/database/models/Department";
import mongoose from "mongoose";

const CreateDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  managerId: z.string().optional(),
});

const UpdateDepartmentSchema = CreateDepartmentSchema.partial();

export async function createDepartment(formData: FormData) {
  const session = await requireAuth();
  await requirePermission(session, "DEPARTMENT", "CREATE");
  await connectToDatabase();

  const input = CreateDepartmentSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    managerId: formData.get("managerId") || undefined,
  });

  // Check for duplicate name
  const existing = await DepartmentModel.findOne({
    companyId: new mongoose.Types.ObjectId(session.companyId),
    name: input.name,
  });
  if (existing) {
    throw new Error(`Department "${input.name}" already exists`);
  }

  const department = await DepartmentModel.create({
    companyId: new mongoose.Types.ObjectId(session.companyId),
    name: input.name,
    description: input.description,
    managerId: input.managerId ? new mongoose.Types.ObjectId(input.managerId) : undefined,
    isActive: true,
  });

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "CREATE",
    module: "Department",
    resourceId: department._id.toString(),
    newValue: input,
  });

  revalidatePath("/settings/departments");
  return { success: true, id: department._id.toString() };
}

export async function getDepartments() {
  const session = await requireAuth();
  await requirePermission(session, "DEPARTMENT", "READ");
  await connectToDatabase();

  const departments = await DepartmentModel.find({
    companyId: new mongoose.Types.ObjectId(session.companyId),
  })
    .populate("managerId", "name")
    .sort({ name: 1 });

  return departments.map(d => ({
    id: d._id.toString(),
    name: d.name,
    description: d.description,
    managerId: d.managerId?._id?.toString(),
    managerName: (d.managerId as unknown as { name: string })?.name,
    isActive: d.isActive,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

export async function getActiveDepartments() {
  const session = await requireAuth();
  await connectToDatabase();

  const departments = await DepartmentModel.find({
    companyId: new mongoose.Types.ObjectId(session.companyId),
    isActive: true,
  }).sort({ name: 1 });

  return departments.map(d => ({
    id: d._id.toString(),
    name: d.name,
  }));
}

export async function updateDepartment(departmentId: string, formData: FormData) {
  const session = await requireAuth();
  await requirePermission(session, "DEPARTMENT", "UPDATE");
  await connectToDatabase();

  const input = UpdateDepartmentSchema.parse({
    name: formData.get("name") || undefined,
    description: formData.get("description") || undefined,
    managerId: formData.get("managerId") || undefined,
  });

  // Check for duplicate name if changing
  if (input.name) {
    const existing = await DepartmentModel.findOne({
      companyId: new mongoose.Types.ObjectId(session.companyId),
      name: input.name,
      _id: { $ne: new mongoose.Types.ObjectId(departmentId) },
    });
    if (existing) {
      throw new Error(`Department "${input.name}" already exists`);
    }
  }

  const updateData: Record<string, unknown> = { ...input };
  if (input.managerId) {
    updateData.managerId = new mongoose.Types.ObjectId(input.managerId);
  }

  const department = await DepartmentModel.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(departmentId),
      companyId: new mongoose.Types.ObjectId(session.companyId),
    },
    { $set: updateData },
    { new: true }
  );

  if (!department) throw new Error("Department not found");

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "UPDATE",
    module: "Department",
    resourceId: departmentId,
    newValue: input,
  });

  revalidatePath("/settings/departments");
  return { success: true };
}

export async function toggleDepartment(departmentId: string) {
  const session = await requireAuth();
  await requirePermission(session, "DEPARTMENT", "UPDATE");
  await connectToDatabase();

  const department = await DepartmentModel.findOne({
    _id: new mongoose.Types.ObjectId(departmentId),
    companyId: new mongoose.Types.ObjectId(session.companyId),
  });

  if (!department) throw new Error("Department not found");

  department.isActive = !department.isActive;
  await department.save();

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "UPDATE",
    module: "Department",
    resourceId: departmentId,
    newValue: { isActive: department.isActive },
  });

  revalidatePath("/settings/departments");
  return { success: true };
}

export async function deleteDepartment(departmentId: string) {
  const session = await requireAuth();
  await requirePermission(session, "DEPARTMENT", "DELETE");
  await connectToDatabase();

  const department = await DepartmentModel.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(departmentId),
    companyId: new mongoose.Types.ObjectId(session.companyId),
  });

  if (!department) throw new Error("Department not found");

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "DELETE",
    module: "Department",
    resourceId: departmentId,
  });

  revalidatePath("/settings/departments");
  return { success: true };
}
