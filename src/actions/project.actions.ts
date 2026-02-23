"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/page-session";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { ProjectModel } from "@/infrastructure/database/models/Project";
import mongoose from "mongoose";

const CreateProjectSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  departmentId: z.string().optional(),
  costCenterId: z.string().optional(),
  managerId: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  budget: z.number().optional(),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
});

const UpdateProjectSchema = CreateProjectSchema.partial();

export async function createProject(formData: FormData) {
  const session = await requireAuth();
  await requirePermission(session, "PROJECT", "CREATE");
  await connectToDatabase();

  const input = CreateProjectSchema.parse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    departmentId: formData.get("departmentId") || undefined,
    costCenterId: formData.get("costCenterId") || undefined,
    managerId: formData.get("managerId") || undefined,
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
    budget: formData.get("budget") ? parseFloat(formData.get("budget") as string) : undefined,
    status: (formData.get("status") as "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED") || "PLANNING",
  });

  // Check for duplicate code
  const existing = await ProjectModel.findOne({
    companyId: new mongoose.Types.ObjectId(session.companyId),
    code: input.code,
  });
  if (existing) {
    throw new Error(`Project with code "${input.code}" already exists`);
  }

  const project = await ProjectModel.create({
    companyId: new mongoose.Types.ObjectId(session.companyId),
    code: input.code,
    name: input.name,
    description: input.description,
    departmentId: input.departmentId ? new mongoose.Types.ObjectId(input.departmentId) : undefined,
    costCenterId: input.costCenterId ? new mongoose.Types.ObjectId(input.costCenterId) : undefined,
    managerId: input.managerId ? new mongoose.Types.ObjectId(input.managerId) : undefined,
    startDate: input.startDate,
    endDate: input.endDate,
    budget: input.budget,
    status: input.status || "PLANNING",
    isActive: true,
    createdBy: new mongoose.Types.ObjectId(session.user.id),
  });

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "CREATE",
    module: "Project",
    resourceId: project._id.toString(),
    newValue: input,
  });

  revalidatePath("/projects");
  return { success: true, id: project._id.toString() };
}

export async function getProjects(filters?: { status?: string; departmentId?: string }) {
  const session = await requireAuth();
  await requirePermission(session, "PROJECT", "READ");
  await connectToDatabase();

  const query: Record<string, unknown> = {
    companyId: new mongoose.Types.ObjectId(session.companyId),
  };

  if (filters?.status) {
    query.status = filters.status;
  }
  if (filters?.departmentId) {
    query.departmentId = new mongoose.Types.ObjectId(filters.departmentId);
  }

  const projects = await ProjectModel.find(query)
    .populate("departmentId", "name")
    .populate("costCenterId", "code name")
    .populate("managerId", "name")
    .sort({ code: 1 });

  return projects.map(p => ({
    id: p._id.toString(),
    code: p.code,
    name: p.name,
    description: p.description,
    departmentId: p.departmentId?._id?.toString(),
    departmentName: (p.departmentId as unknown as { name: string })?.name,
    costCenterId: p.costCenterId?._id?.toString(),
    costCenterCode: (p.costCenterId as unknown as { code: string })?.code,
    costCenterName: (p.costCenterId as unknown as { name: string })?.name,
    managerId: p.managerId?._id?.toString(),
    managerName: (p.managerId as unknown as { name: string })?.name,
    startDate: p.startDate,
    endDate: p.endDate,
    budget: p.budget ? parseFloat(p.budget.toString()) : null,
    status: p.status,
    isActive: p.isActive,
    createdAt: p.createdAt,
  }));
}

export async function getActiveProjects() {
  const session = await requireAuth();
  await connectToDatabase();

  const projects = await ProjectModel.find({
    companyId: new mongoose.Types.ObjectId(session.companyId),
    isActive: true,
    status: { $in: ["PLANNING", "ACTIVE"] },
  }).sort({ code: 1 });

  return projects.map(p => ({
    id: p._id.toString(),
    code: p.code,
    name: p.name,
  }));
}

export async function updateProject(projectId: string, formData: FormData) {
  const session = await requireAuth();
  await requirePermission(session, "PROJECT", "UPDATE");
  await connectToDatabase();

  const input = UpdateProjectSchema.parse({
    code: formData.get("code") || undefined,
    name: formData.get("name") || undefined,
    description: formData.get("description") || undefined,
    departmentId: formData.get("departmentId") || undefined,
    costCenterId: formData.get("costCenterId") || undefined,
    managerId: formData.get("managerId") || undefined,
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
    budget: formData.get("budget") ? parseFloat(formData.get("budget") as string) : undefined,
    status: formData.get("status") as "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED" || undefined,
  });

  // Check for duplicate code if changing
  if (input.code) {
    const existing = await ProjectModel.findOne({
      companyId: new mongoose.Types.ObjectId(session.companyId),
      code: input.code,
      _id: { $ne: new mongoose.Types.ObjectId(projectId) },
    });
    if (existing) {
      throw new Error(`Project with code "${input.code}" already exists`);
    }
  }

  const updateData: Record<string, unknown> = { ...input };
  if (input.departmentId) updateData.departmentId = new mongoose.Types.ObjectId(input.departmentId);
  if (input.costCenterId) updateData.costCenterId = new mongoose.Types.ObjectId(input.costCenterId);
  if (input.managerId) updateData.managerId = new mongoose.Types.ObjectId(input.managerId);

  const project = await ProjectModel.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(projectId),
      companyId: new mongoose.Types.ObjectId(session.companyId),
    },
    { $set: updateData },
    { new: true }
  );

  if (!project) throw new Error("Project not found");

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "UPDATE",
    module: "Project",
    resourceId: projectId,
    newValue: input,
  });

  revalidatePath("/projects");
  return { success: true };
}

export async function updateProjectStatus(projectId: string, status: string) {
  const session = await requireAuth();
  await requirePermission(session, "PROJECT", "UPDATE");
  await connectToDatabase();

  const validStatuses = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid status");
  }

  const project = await ProjectModel.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(projectId),
      companyId: new mongoose.Types.ObjectId(session.companyId),
    },
    { $set: { status } },
    { new: true }
  );

  if (!project) throw new Error("Project not found");

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "UPDATE",
    module: "Project",
    resourceId: projectId,
    newValue: { status },
  });

  revalidatePath("/projects");
  return { success: true };
}

export async function deleteProject(projectId: string) {
  const session = await requireAuth();
  await requirePermission(session, "PROJECT", "DELETE");
  await connectToDatabase();

  const project = await ProjectModel.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(projectId),
    companyId: new mongoose.Types.ObjectId(session.companyId),
  });

  if (!project) throw new Error("Project not found");

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "DELETE",
    module: "Project",
    resourceId: projectId,
  });

  revalidatePath("/projects");
  return { success: true };
}

// Get project summary with financial data
export async function getProjectSummary(projectId: string) {
  const session = await requireAuth();
  await requirePermission(session, "PROJECT", "READ");
  await connectToDatabase();

  const project = await ProjectModel.findOne({
    _id: new mongoose.Types.ObjectId(projectId),
    companyId: new mongoose.Types.ObjectId(session.companyId),
  })
    .populate("departmentId", "name")
    .populate("costCenterId", "code name")
    .populate("managerId", "name");

  if (!project) throw new Error("Project not found");

  // TODO: Aggregate actual expenses/revenues linked to this project
  // This would require adding projectId field to Expense and Revenue models

  return {
    id: project._id.toString(),
    code: project.code,
    name: project.name,
    description: project.description,
    department: (project.departmentId as unknown as { name: string })?.name,
    costCenter: `${(project.costCenterId as unknown as { code: string })?.code} - ${(project.costCenterId as unknown as { name: string })?.name}`,
    manager: (project.managerId as unknown as { name: string })?.name,
    startDate: project.startDate,
    endDate: project.endDate,
    budget: project.budget ? parseFloat(project.budget.toString()) : 0,
    status: project.status,
    // Placeholder for when project expenses are tracked
    actualSpent: 0,
    variance: project.budget ? parseFloat(project.budget.toString()) : 0,
    completionPercentage: 0,
  };
}
