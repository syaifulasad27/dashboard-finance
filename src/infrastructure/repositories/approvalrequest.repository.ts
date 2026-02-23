import mongoose, { ClientSession } from "mongoose";
import { BaseRepository } from "./base.repository";
import { ApprovalRequestModel, IApprovalRequest } from "@/infrastructure/database/models/ApprovalRequest";

export class ApprovalRequestRepository extends BaseRepository<IApprovalRequest> {
  constructor() {
    super(ApprovalRequestModel);
  }

  /**
   * Find pending requests for approval
   */
  async findPending(companyId: string, session?: ClientSession): Promise<IApprovalRequest[]> {
    return this.find(
      companyId,
      { status: { $in: ["PENDING", "IN_PROGRESS"] } },
      { sort: { createdAt: -1 }, session }
    );
  }

  /**
   * Find requests by resource
   */
  async findByResource(
    companyId: string,
    resourceType: IApprovalRequest["resourceType"],
    resourceId: string,
    session?: ClientSession
  ): Promise<IApprovalRequest | null> {
    return this.findOne(
      companyId,
      {
        resourceType,
        resourceId: new mongoose.Types.ObjectId(resourceId),
        status: { $nin: ["CANCELLED"] },
      },
      { session }
    );
  }

  /**
   * Find requests awaiting user's approval
   */
  async findAwaitingApproval(
    companyId: string,
    userRole: string,
    userId?: string,
    session?: ClientSession
  ): Promise<IApprovalRequest[]> {
    // This needs to join with ApprovalConfig to check current step
    // For now, return all pending with config populated
    await this.ensureConnection();

    const query = ApprovalRequestModel.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          status: { $in: ["PENDING", "IN_PROGRESS"] },
        },
      },
      {
        $lookup: {
          from: "approvalconfigs",
          localField: "configId",
          foreignField: "_id",
          as: "config",
        },
      },
      { $unwind: "$config" },
      {
        $addFields: {
          currentStepConfig: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$config.steps",
                  cond: { $eq: ["$$this.order", "$currentStep"] },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $match: {
          "currentStepConfig.role": userRole,
        },
      },
      { $sort: { createdAt: -1 } },
    ]).session(session || null);

    return query;
  }

  /**
   * Update request status
   */
  async updateStatus(
    companyId: string,
    requestId: string,
    status: IApprovalRequest["status"],
    session?: ClientSession
  ): Promise<IApprovalRequest | null> {
    return this.updateById(companyId, requestId, { $set: { status } }, session);
  }

  /**
   * Add history entry
   */
  async addHistoryEntry(
    companyId: string,
    requestId: string,
    entry: {
      step: number;
      action: "APPROVED" | "REJECTED";
      userId: string;
      userName: string;
      comment?: string;
    },
    session?: ClientSession
  ): Promise<IApprovalRequest | null> {
    return this.updateById(
      companyId,
      requestId,
      {
        $push: {
          history: {
            ...entry,
            userId: new mongoose.Types.ObjectId(entry.userId),
            timestamp: new Date(),
          },
        },
      },
      session
    );
  }

  /**
   * Get approval statistics
   */
  async getApprovalStats(
    companyId: string,
    startDate?: Date,
    endDate?: Date,
    session?: ClientSession
  ): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    avgApprovalTime: number;
  }> {
    await this.ensureConnection();

    const match: Record<string, unknown> = {
      companyId: new mongoose.Types.ObjectId(companyId),
    };
    if (startDate && endDate) {
      match.createdAt = { $gte: startDate, $lte: endDate };
    }

    const stats = await ApprovalRequestModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]).session(session || null);

    const result = {
      pending: 0,
      approved: 0,
      rejected: 0,
      avgApprovalTime: 0,
    };

    for (const s of stats) {
      if (s._id === "PENDING" || s._id === "IN_PROGRESS") {
        result.pending += s.count;
      } else if (s._id === "APPROVED") {
        result.approved = s.count;
      } else if (s._id === "REJECTED") {
        result.rejected = s.count;
      }
    }

    return result;
  }
}

export const approvalRequestRepository = new ApprovalRequestRepository();
