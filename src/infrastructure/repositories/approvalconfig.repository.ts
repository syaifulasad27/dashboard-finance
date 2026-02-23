import mongoose, { ClientSession } from "mongoose";
import { BaseRepository } from "./base.repository";
import { ApprovalConfigModel, IApprovalConfig } from "@/infrastructure/database/models/ApprovalConfig";

export class ApprovalConfigRepository extends BaseRepository<IApprovalConfig> {
  constructor() {
    super(ApprovalConfigModel);
  }

  /**
   * Find active configs for a resource type
   */
  async findByResourceType(
    companyId: string,
    resourceType: IApprovalConfig["resourceType"],
    session?: ClientSession
  ): Promise<IApprovalConfig[]> {
    return this.find(
      companyId,
      { resourceType, isActive: true },
      { sort: { amountThreshold: -1 }, session }
    );
  }

  /**
   * Find applicable config for amount
   */
  async findApplicableConfig(
    companyId: string,
    resourceType: IApprovalConfig["resourceType"],
    amount: number,
    session?: ClientSession
  ): Promise<IApprovalConfig | null> {
    await this.ensureConnection();

    let query = ApprovalConfigModel.findOne({
      companyId: new mongoose.Types.ObjectId(companyId),
      resourceType,
      isActive: true,
      amountThreshold: { $lte: amount },
    }).sort({ amountThreshold: -1 });

    if (session) query = query.session(session);

    return query.lean();
  }

  /**
   * Toggle config active status
   */
  async toggleActive(
    companyId: string,
    configId: string,
    session?: ClientSession
  ): Promise<IApprovalConfig | null> {
    await this.ensureConnection();

    const config = await this.findById(companyId, configId, { session });
    if (!config) return null;

    return this.updateById(
      companyId,
      configId,
      { $set: { isActive: !config.isActive } },
      session
    );
  }

  /**
   * Get all configs grouped by resource type
   */
  async getConfigsByType(
    companyId: string,
    session?: ClientSession
  ): Promise<Record<string, IApprovalConfig[]>> {
    const configs = await this.find(companyId, {}, { sort: { resourceType: 1, amountThreshold: -1 }, session });

    const grouped: Record<string, IApprovalConfig[]> = {};
    for (const config of configs) {
      if (!grouped[config.resourceType]) {
        grouped[config.resourceType] = [];
      }
      grouped[config.resourceType].push(config);
    }

    return grouped;
  }
}

export const approvalConfigRepository = new ApprovalConfigRepository();
