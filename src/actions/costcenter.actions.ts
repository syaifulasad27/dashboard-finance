"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/page-session";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { CostCenterModel } from "@/infrastructure/database/models/CostCenter";
import mongoose from "mongoose";

const CreateCostCenterSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

const UpdateCostCenterSchema = CreateCostCenterSchema.partial();

export async function createCostCenter(formData: FormData) {
  const session = await requireAuth();
  await requirePermission(session, "COST_CENTER", "CREATE");
  await connectToDatabase();

  const input = CreateCostCenterSchema.parse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  // Check for duplicate code
  const existing = await CostCenterModel.findOne({
    companyId: new mongoose.Types.ObjectId(session.companyId),
    code: input.code,
  });
  if (existing) {
    throw new Error(`Cost center with code "${input.code}" already exists`);
  }

  const costCenter = await CostCenterModel.create({
    companyId: new mongoose.Types.ObjectId(session.companyId),
    ...input,
    isActive: true,
  });

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "CREATE",
    module: "CostCenter",
    resourceId: costCenter._id.toString(),
    newValue: input,
  });

  revalidatePath("/settings/cost-centers");
  return { success: true, id: costCenter._id.toString() };
}

export async function getCostCenters() {
  const session = await requireAuth();
  await requirePermission(session, "COST_CENTER", "READ");
  await connectToDatabase();

  const costCenters = await CostCenterModel.find({
    companyId: new mongoose.Types.ObjectId(session.companyId),
  }).sort({ code: 1 });

  return costCenters.map(cc => ({
    id: cc._id.toString(),
    code: cc.code,
    name: cc.name,
    description: cc.description,
    isActive: cc.isActive,
    createdAt: cc.createdAt,
    updatedAt: cc.updatedAt,
  }));
}

export async function getActiveCostCenters() {
  const session = await requireAuth();
  await connectToDatabase();

  const costCenters = await CostCenterModel.find({
    companyId: new mongoose.Types.ObjectId(session.companyId),
    isActive: true,
  }).sort({ code: 1 });

  return costCenters.map(cc => ({
    id: cc._id.toString(),
    code: cc.code,
    name: cc.name,
  }));
}

export async function updateCostCenter(costCenterId: string, formData: FormData) {
  const session = await requireAuth();
  await requirePermission(session, "COST_CENTER", "UPDATE");
  await connectToDatabase();

  const input = UpdateCostCenterSchema.parse({
    code: formData.get("code") || undefined,
    name: formData.get("name") || undefined,
    description: formData.get("description") || undefined,
  });

  // Check for duplicate code if changing
  if (input.code) {
    const existing = await CostCenterModel.findOne({
      companyId: new mongoose.Types.ObjectId(session.companyId),
      code: input.code,
      _id: { $ne: new mongoose.Types.ObjectId(costCenterId) },
    });
    if (existing) {
      throw new Error(`Cost center with code "${input.code}" already exists`);
    }
  }

  const costCenter = await CostCenterModel.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(costCenterId),
      companyId: new mongoose.Types.ObjectId(session.companyId),
    },
    { $set: input },
    { new: true }
  );

  if (!costCenter) throw new Error("Cost center not found");

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "UPDATE",
    module: "CostCenter",
    resourceId: costCenterId,
    newValue: input,
  });

  revalidatePath("/settings/cost-centers");
  return { success: true };
}

export async function toggleCostCenter(costCenterId: string) {
  const session = await requireAuth();
  await requirePermission(session, "COST_CENTER", "UPDATE");
  await connectToDatabase();

  const costCenter = await CostCenterModel.findOne({
    _id: new mongoose.Types.ObjectId(costCenterId),
    companyId: new mongoose.Types.ObjectId(session.companyId),
  });

  if (!costCenter) throw new Error("Cost center not found");

  costCenter.isActive = !costCenter.isActive;
  await costCenter.save();

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "UPDATE",
    module: "CostCenter",
    resourceId: costCenterId,
    newValue: { isActive: costCenter.isActive },
  });

  revalidatePath("/settings/cost-centers");
  return { success: true };
}

export async function deleteCostCenter(costCenterId: string) {
  const session = await requireAuth();
  await requirePermission(session, "COST_CENTER", "DELETE");
  await connectToDatabase();

  const costCenter = await CostCenterModel.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(costCenterId),
    companyId: new mongoose.Types.ObjectId(session.companyId),
  });

  if (!costCenter) throw new Error("Cost center not found");

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "DELETE",
    module: "CostCenter",
    resourceId: costCenterId,
  });

  revalidatePath("/settings/cost-centers");
  return { success: true };
}
