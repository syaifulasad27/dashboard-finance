import mongoose from "mongoose";
import { ApprovalConfigModel, IApprovalConfig, IApprovalStep } from "@/infrastructure/database/models/ApprovalConfig";
import { ApprovalRequestModel, IApprovalRequest } from "@/infrastructure/database/models/ApprovalRequest";

export interface ApprovalContext {
  companyId: string;
  userId: string;
  userName: string;
  userRole: string;
}

export interface SubmitForApprovalParams {
  resourceType: "EXPENSE" | "REVENUE" | "JOURNAL" | "PAYROLL";
  resourceId: string;
  amount: number;
}

export class WorkflowEngine {
  /**
   * Find applicable approval config for a resource type and amount
   */
  static async findApplicableConfig(
    companyId: string,
    resourceType: string,
    amount: number
  ): Promise<IApprovalConfig | null> {
    const configs = await ApprovalConfigModel.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      resourceType,
      isActive: true,
    }).sort({ amountThreshold: -1 }); // Highest threshold first

    // Find config where amount meets or exceeds threshold
    for (const config of configs) {
      if (amount >= (config.amountThreshold || 0)) {
        return config;
      }
    }

    return null;
  }

  /**
   * Submit a resource for approval workflow
   */
  static async submitForApproval(
    ctx: ApprovalContext,
    params: SubmitForApprovalParams,
    mongoSession?: mongoose.ClientSession
  ): Promise<IApprovalRequest | null> {
    const config = await this.findApplicableConfig(
      ctx.companyId,
      params.resourceType,
      params.amount
    );

    if (!config) {
      // No approval workflow configured - auto-approve
      return null;
    }

    const request = new ApprovalRequestModel({
      companyId: new mongoose.Types.ObjectId(ctx.companyId),
      configId: config._id,
      resourceType: params.resourceType,
      resourceId: new mongoose.Types.ObjectId(params.resourceId),
      requestedBy: new mongoose.Types.ObjectId(ctx.userId),
      currentStep: 1,
      totalSteps: config.steps.length,
      status: "PENDING",
      history: [],
    });

    await request.save({ session: mongoSession });
    return request;
  }

  /**
   * Get pending approvals for a user based on their role
   */
  static async getPendingApprovalsForUser(
    companyId: string,
    userRole: string,
    userId?: string
  ): Promise<IApprovalRequest[]> {
    // Get all configs where user's role is in any step
    const configs = await ApprovalConfigModel.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      isActive: true,
      "steps.role": userRole,
    });

    const configMap = new Map(configs.map(c => [c._id.toString(), c]));
    const configIds = configs.map(c => c._id);

    // Get pending requests for those configs
    const requests = await ApprovalRequestModel.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      configId: { $in: configIds },
      status: { $in: ["PENDING", "IN_PROGRESS"] },
    }).sort({ createdAt: -1 });

    // Filter to only requests where user can act on current step
    return requests.filter(req => {
      const config = configMap.get(req.configId.toString());
      if (!config) return false;

      const currentStepConfig = config.steps.find((s: IApprovalStep) => s.order === req.currentStep);
      if (!currentStepConfig) return false;

      // Check if user's role matches the step's required role
      if (currentStepConfig.role !== userRole) return false;

      // If specific approver is set, check user ID
      if (currentStepConfig.approverId && userId) {
        return currentStepConfig.approverId.toString() === userId;
      }

      return true;
    });
  }

  /**
   * Approve the current step
   */
  static async approve(
    ctx: ApprovalContext,
    requestId: string,
    comment?: string,
    mongoSession?: mongoose.ClientSession
  ): Promise<{ success: boolean; isFullyApproved: boolean; error?: string }> {
    const request = await ApprovalRequestModel.findOne({
      _id: new mongoose.Types.ObjectId(requestId),
      companyId: new mongoose.Types.ObjectId(ctx.companyId),
    }).session(mongoSession || null);

    if (!request) {
      return { success: false, isFullyApproved: false, error: "Approval request not found" };
    }

    if (request.status === "APPROVED" || request.status === "REJECTED") {
      return { success: false, isFullyApproved: false, error: "Request already finalized" };
    }

    // Verify user can approve this step
    const config = await ApprovalConfigModel.findById(request.configId);
    if (!config) {
      return { success: false, isFullyApproved: false, error: "Approval config not found" };
    }

    const currentStepConfig = config.steps.find((s: IApprovalStep) => s.order === request.currentStep);
    if (!currentStepConfig) {
      return { success: false, isFullyApproved: false, error: "Invalid step configuration" };
    }

    if (currentStepConfig.role !== ctx.userRole) {
      return { success: false, isFullyApproved: false, error: "User role does not match required role" };
    }

    if (currentStepConfig.approverId && currentStepConfig.approverId.toString() !== ctx.userId) {
      return { success: false, isFullyApproved: false, error: "User is not the designated approver" };
    }

    // Add to history
    request.history.push({
      step: request.currentStep,
      action: "APPROVED",
      userId: new mongoose.Types.ObjectId(ctx.userId),
      userName: ctx.userName,
      comment,
      timestamp: new Date(),
    });

    // Check if this was the last step
    if (request.currentStep >= request.totalSteps) {
      request.status = "APPROVED";
    } else {
      request.currentStep += 1;
      request.status = "IN_PROGRESS";
    }

    await request.save({ session: mongoSession });

    return { 
      success: true, 
      isFullyApproved: request.status === "APPROVED" 
    };
  }

  /**
   * Reject the approval request
   */
  static async reject(
    ctx: ApprovalContext,
    requestId: string,
    reason: string,
    mongoSession?: mongoose.ClientSession
  ): Promise<{ success: boolean; error?: string }> {
    const request = await ApprovalRequestModel.findOne({
      _id: new mongoose.Types.ObjectId(requestId),
      companyId: new mongoose.Types.ObjectId(ctx.companyId),
    }).session(mongoSession || null);

    if (!request) {
      return { success: false, error: "Approval request not found" };
    }

    if (request.status === "APPROVED" || request.status === "REJECTED") {
      return { success: false, error: "Request already finalized" };
    }

    // Verify user can reject this step
    const config = await ApprovalConfigModel.findById(request.configId);
    if (!config) {
      return { success: false, error: "Approval config not found" };
    }

    const currentStepConfig = config.steps.find((s: IApprovalStep) => s.order === request.currentStep);
    if (!currentStepConfig || currentStepConfig.role !== ctx.userRole) {
      return { success: false, error: "User cannot reject at this step" };
    }

    // Add to history
    request.history.push({
      step: request.currentStep,
      action: "REJECTED",
      userId: new mongoose.Types.ObjectId(ctx.userId),
      userName: ctx.userName,
      comment: reason,
      timestamp: new Date(),
    });

    request.status = "REJECTED";
    request.rejectionReason = reason;

    await request.save({ session: mongoSession });

    return { success: true };
  }

  /**
   * Cancel an approval request (by the requester)
   */
  static async cancel(
    ctx: ApprovalContext,
    requestId: string,
    mongoSession?: mongoose.ClientSession
  ): Promise<{ success: boolean; error?: string }> {
    const request = await ApprovalRequestModel.findOne({
      _id: new mongoose.Types.ObjectId(requestId),
      companyId: new mongoose.Types.ObjectId(ctx.companyId),
      requestedBy: new mongoose.Types.ObjectId(ctx.userId),
    }).session(mongoSession || null);

    if (!request) {
      return { success: false, error: "Approval request not found or not owned by user" };
    }

    if (request.status === "APPROVED" || request.status === "REJECTED") {
      return { success: false, error: "Cannot cancel finalized request" };
    }

    request.status = "CANCELLED";
    await request.save({ session: mongoSession });

    return { success: true };
  }

  /**
   * Get approval request details with config info
   */
  static async getRequestDetails(
    companyId: string,
    requestId: string
  ): Promise<{ request: IApprovalRequest; config: IApprovalConfig } | null> {
    const request = await ApprovalRequestModel.findOne({
      _id: new mongoose.Types.ObjectId(requestId),
      companyId: new mongoose.Types.ObjectId(companyId),
    });

    if (!request) return null;

    const config = await ApprovalConfigModel.findById(request.configId);
    if (!config) return null;

    return { request, config };
  }

  /**
   * Get approval request by resource
   */
  static async getRequestByResource(
    companyId: string,
    resourceType: string,
    resourceId: string
  ): Promise<IApprovalRequest | null> {
    return ApprovalRequestModel.findOne({
      companyId: new mongoose.Types.ObjectId(companyId),
      resourceType,
      resourceId: new mongoose.Types.ObjectId(resourceId),
      status: { $nin: ["CANCELLED"] },
    });
  }
}
