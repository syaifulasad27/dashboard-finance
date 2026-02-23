import mongoose, { ClientSession } from "mongoose";
import { BaseRepository } from "./base.repository";
import { RevenueModel, IRevenue } from "@/infrastructure/database/models/Revenue";

export class RevenueRepository extends BaseRepository<IRevenue> {
  constructor() {
    super(RevenueModel);
  }

  /**
   * Find revenue by invoice number
   */
  async findByInvoiceNumber(
    companyId: string,
    invoiceNumber: string,
    session?: ClientSession
  ): Promise<IRevenue | null> {
    return this.findOne(companyId, { invoiceNumber }, { session });
  }

  /**
   * Find revenues by date range
   */
  async findByDateRange(
    companyId: string,
    startDate: Date,
    endDate: Date,
    session?: ClientSession
  ): Promise<IRevenue[]> {
    return this.find(
      companyId,
      { date: { $gte: startDate, $lte: endDate } },
      { sort: { date: -1 }, session }
    );
  }

  /**
   * Find unpaid revenues
   */
  async findUnpaid(companyId: string): Promise<IRevenue[]> {
    return this.find(companyId, { status: "UNPAID" }, { sort: { date: -1 } });
  }

  /**
   * Get recent revenues with pagination
   */
  async getRecent(
    companyId: string,
    limit: number = 50,
    skip: number = 0
  ): Promise<IRevenue[]> {
    return this.find(companyId, {}, { limit, skip, sort: { date: -1 } });
  }

  /**
   * Link journal to revenue
   */
  async linkJournal(
    companyId: string,
    revenueId: string,
    journalId: string,
    session?: ClientSession
  ): Promise<IRevenue | null> {
    return this.updateById(
      companyId,
      revenueId,
      { $set: { journalId: new mongoose.Types.ObjectId(journalId) } },
      session
    );
  }

  /**
   * Update revenue status
   */
  async updateStatus(
    companyId: string,
    revenueId: string,
    status: IRevenue["status"],
    session?: ClientSession
  ): Promise<IRevenue | null> {
    return this.updateById(companyId, revenueId, { $set: { status } }, session);
  }

  /**
   * Void a revenue entry
   */
  async void(
    companyId: string,
    revenueId: string,
    session?: ClientSession
  ): Promise<IRevenue | null> {
    return this.updateStatus(companyId, revenueId, "VOID", session);
  }
}

// Export singleton instance
export const revenueRepository = new RevenueRepository();
