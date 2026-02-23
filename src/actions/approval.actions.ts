"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/page-session";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { ApprovalConfigModel } from "@/infrastructure/database/models/ApprovalConfig";
import { ApprovalRequestModel } from "@/infrastructure/database/models/ApprovalRequest";
import { WorkflowEngine } from "@/core/engines/workflow.engine";
import mongoose from "mongoose";

// === APPROVAL CONFIG ACTIONS ===

const ApprovalStepSchema = z.object({
  order: z.number().min(1),
  role: z.string().min(1),
  approverId: z.string().optional(),
  description: z.string().optional(),
});

const CreateConfigSchema = z.object({
  resourceType: z.enum(["EXPENSE", "REVENUE", "JOURNAL", "PAYROLL"]),
  name: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(ApprovalStepSchema).min(1),
  amountThreshold: z.number().optional(),
});

export async function createApprovalConfig(formData: FormData) {
  const session = await requireAuth();
  await requirePermission(session, "APPROVAL_CONFIG", "CREATE");
  await connectToDatabase();

  const input = CreateConfigSchema.parse({
    resourceType: formData.get("resourceType"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    steps: JSON.parse(formData.get("steps") as string),
    amountThreshold: formData.get("amountThreshold") 
      ? parseFloat(formData.get("amountThreshold") as string) 
      : undefined,
  });

  const config = await ApprovalConfigModel.create({
    companyId: new mongoose.Types.ObjectId(session.companyId),
    ...input,
  });

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "CREATE",
    module: "ApprovalConfig",
    resourceId: config._id.toString(),
    newValue: input,
  });

  revalidatePath("/settings/approval");
  return { success: true, id: config._id.toString() };
}

export async function getApprovalConfigs() {
  const session = await requireAuth();
  await requirePermission(session, "APPROVAL_CONFIG", "READ");
  await connectToDatabase();

  const configs = await ApprovalConfigModel.find({
    companyId: new mongoose.Types.ObjectId(session.companyId),
  }).sort({ resourceType: 1, amountThreshold: -1 });

  return configs.map(c => ({
    id: c._id.toString(),
    resourceType: c.resourceType,
    name: c.name,
    description: c.description,
    steps: c.steps,
    amountThreshold: c.amountThreshold || 0,
    isActive: c.isActive,
    createdAt: c.createdAt,
  }));
}

export async function toggleApprovalConfig(configId: string) {
  const session = await requireAuth();
  await requirePermission(session, "APPROVAL_CONFIG", "UPDATE");
  await connectToDatabase();

  const config = await ApprovalConfigModel.findOne({
    _id: new mongoose.Types.ObjectId(configId),
    companyId: new mongoose.Types.ObjectId(session.companyId),
  });

  if (!config) throw new Error("Config not found");

  config.isActive = !config.isActive;
  await config.save();

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "UPDATE",
    module: "ApprovalConfig",
    resourceId: configId,
    newValue: { isActive: config.isActive },
  });

  revalidatePath("/settings/approval");
  return { success: true };
}

// === APPROVAL REQUEST ACTIONS ===

export async function getPendingApprovals() {
  const session = await requireAuth();
  await connectToDatabase();

  const requests = await WorkflowEngine.getPendingApprovalsForUser(
    session.companyId,
    session.user.role,
    session.user.id
  );

  return requests.map(r => ({
    id: r._id.toString(),
    resourceType: r.resourceType,
    resourceId: r.resourceId.toString(),
    currentStep: r.currentStep,
    totalSteps: r.totalSteps,
    status: r.status,
    createdAt: r.createdAt,
    history: r.history,
  }));
}

export async function approveRequest(requestId: string, comment?: string) {
  const session = await requireAuth();
  await connectToDatabase();

  const mongoSession = await mongoose.startSession();
  try {
    mongoSession.startTransaction();

    const result = await WorkflowEngine.approve(
      {
        companyId: session.companyId,
        userId: session.user.id,
        userName: session.user.name,
        userRole: session.user.role,
      },
      requestId,
      comment,
      mongoSession
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    // If fully approved, update the resource status
    if (result.isFullyApproved) {
      const request = await ApprovalRequestModel.findById(requestId).session(mongoSession);
      if (request) {
        // Dynamically update the resource based on type
        const modelMap: Record<string, string> = {
          EXPENSE: "Expense",
          REVENUE: "Revenue",
          JOURNAL: "JournalEntry",
          PAYROLL: "Payroll",
        };
        const Model = mongoose.model(modelMap[request.resourceType]);
        await Model.findByIdAndUpdate(
          request.resourceId,
          { approvalStatus: "APPROVED" },
          { session: mongoSession }
        );
      }
    }

    await mongoSession.commitTransaction();

    await logAction({
      companyId: session.companyId,
      userId: session.user.id,
      action: "APPROVE",
      module: "ApprovalRequest",
      resourceId: requestId,
      newValue: { comment },
    });

    revalidatePath("/approvals");
    revalidatePath("/expense");
    return { success: true, isFullyApproved: result.isFullyApproved };
  } catch (error) {
    await mongoSession.abortTransaction();
    throw error;
  } finally {
    mongoSession.endSession();
  }
}

export async function rejectRequest(requestId: string, reason: string) {
  const session = await requireAuth();
  await connectToDatabase();

  const mongoSession = await mongoose.startSession();
  try {
    mongoSession.startTransaction();

    const result = await WorkflowEngine.reject(
      {
        companyId: session.companyId,
        userId: session.user.id,
        userName: session.user.name,
        userRole: session.user.role,
      },
      requestId,
      reason,
      mongoSession
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    // Update the resource status to REJECTED
    const request = await ApprovalRequestModel.findById(requestId).session(mongoSession);
    if (request) {
      const modelMap: Record<string, string> = {
        EXPENSE: "Expense",
        REVENUE: "Revenue",
        JOURNAL: "JournalEntry",
        PAYROLL: "Payroll",
      };
      const Model = mongoose.model(modelMap[request.resourceType]);
      await Model.findByIdAndUpdate(
        request.resourceId,
        { approvalStatus: "REJECTED" },
        { session: mongoSession }
      );
    }

    await mongoSession.commitTransaction();

    await logAction({
      companyId: session.companyId,
      userId: session.user.id,
      action: "REJECT",
      module: "ApprovalRequest",
      resourceId: requestId,
      newValue: { reason },
    });

    revalidatePath("/approvals");
    revalidatePath("/expense");
    return { success: true };
  } catch (error) {
    await mongoSession.abortTransaction();
    throw error;
  } finally {
    mongoSession.endSession();
  }
}

export async function getApprovalHistory(resourceType: string, resourceId: string) {
  const session = await requireAuth();
  await connectToDatabase();

  const request = await WorkflowEngine.getRequestByResource(
    session.companyId,
    resourceType,
    resourceId
  );

  if (!request) return null;

  const details = await WorkflowEngine.getRequestDetails(session.companyId, request._id.toString());
  if (!details) return null;

  return {
    request: {
      id: details.request._id.toString(),
      currentStep: details.request.currentStep,
      totalSteps: details.request.totalSteps,
      status: details.request.status,
      history: details.request.history,
      rejectionReason: details.request.rejectionReason,
    },
    config: {
      name: details.config.name,
      steps: details.config.steps,
    },
  };
}
