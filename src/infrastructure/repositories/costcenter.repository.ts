import mongoose, { ClientSession } from "mongoose";
import { BaseRepository } from "./base.repository";
import { CostCenterModel, ICostCenter } from "@/infrastructure/database/models/CostCenter";

export class CostCenterRepository extends BaseRepository<ICostCenter> {
  constructor() {
    super(CostCenterModel);
  }

  /**
   * Find active cost centers
   */
  async findActive(companyId: string, session?: ClientSession): Promise<ICostCenter[]> {
    return this.find(companyId, { isActive: true }, { sort: { code: 1 }, session });
  }

  /**
   * Find by code
   */
  async findByCode(
    companyId: string,
    code: string,
    session?: ClientSession
  ): Promise<ICostCenter | null> {
    return this.findOne(companyId, { code }, { session });
  }

  /**
   * Toggle active status
   */
  async toggleActive(
    companyId: string,
    costCenterId: string,
    session?: ClientSession
  ): Promise<ICostCenter | null> {
    await this.ensureConnection();

    const costCenter = await this.findById(companyId, costCenterId, { session });
    if (!costCenter) return null;

    return this.updateById(
      companyId,
      costCenterId,
      { $set: { isActive: !costCenter.isActive } },
      session
    );
  }

  /**
   * Check if code exists
   */
  async codeExists(
    companyId: string,
    code: string,
    excludeId?: string,
    session?: ClientSession
  ): Promise<boolean> {
    await this.ensureConnection();

    const filter: Record<string, unknown> = { code };
    if (excludeId) {
      filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    const existing = await this.findOne(companyId, filter, { session });
    return !!existing;
  }
}

export const costCenterRepository = new CostCenterRepository();
