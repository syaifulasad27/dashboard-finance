import mongoose, { ClientSession } from "mongoose";
import { BaseRepository } from "./base.repository";
import { ExpenseModel, IExpense } from "@/infrastructure/database/models/Expense";

export class ExpenseRepository extends BaseRepository<IExpense> {
  constructor() {
    super(ExpenseModel);
  }

  /**
   * Find expenses by date range
   */
  async findByDateRange(
    companyId: string,
    startDate: Date,
    endDate: Date,
    session?: ClientSession
  ): Promise<IExpense[]> {
    return this.find(
      companyId,
      { date: { $gte: startDate, $lte: endDate } },
      { sort: { date: -1 }, session }
    );
  }

  /**
   * Find pending approval expenses
   */
  async findPendingApproval(companyId: string): Promise<IExpense[]> {
    return this.find(companyId, { approvalStatus: "PENDING" }, { sort: { date: -1 } });
  }

  /**
   * Find approved expenses
   */
  async findApproved(companyId: string): Promise<IExpense[]> {
    return this.find(companyId, { approvalStatus: "APPROVED" }, { sort: { date: -1 } });
  }

  /**
   * Find expenses by category
   */
  async findByCategory(
    companyId: string,
    category: string,
    session?: ClientSession
  ): Promise<IExpense[]> {
    return this.find(companyId, { category }, { sort: { date: -1 }, session });
  }

  /**
   * Get recent expenses with pagination
   */
  async getRecent(
    companyId: string,
    limit: number = 50,
    skip: number = 0
  ): Promise<IExpense[]> {
    return this.find(companyId, {}, { limit, skip, sort: { date: -1 } });
  }

  /**
   * Link journal to expense
   */
  async linkJournal(
    companyId: string,
    expenseId: string,
    journalId: string,
    session?: ClientSession
  ): Promise<IExpense | null> {
    return this.updateById(
      companyId,
      expenseId,
      { $set: { journalId: new mongoose.Types.ObjectId(journalId) } },
      session
    );
  }

  /**
   * Update approval status
   */
  async updateApprovalStatus(
    companyId: string,
    expenseId: string,
    status: IExpense["approvalStatus"],
    session?: ClientSession
  ): Promise<IExpense | null> {
    return this.updateById(companyId, expenseId, { $set: { approvalStatus: status } }, session);
  }

  /**
   * Approve expense
   */
  async approve(
    companyId: string,
    expenseId: string,
    session?: ClientSession
  ): Promise<IExpense | null> {
    return this.updateApprovalStatus(companyId, expenseId, "APPROVED", session);
  }

  /**
   * Reject expense
   */
  async reject(
    companyId: string,
    expenseId: string,
    session?: ClientSession
  ): Promise<IExpense | null> {
    return this.updateApprovalStatus(companyId, expenseId, "REJECTED", session);
  }

  /**
   * Void an approved expense
   */
  async void(
    companyId: string,
    expenseId: string,
    reason: string,
    session?: ClientSession
  ): Promise<IExpense | null> {
    return this.updateById(
      companyId,
      expenseId,
      { $set: { approvalStatus: "VOIDED", voidReason: reason, voidedAt: new Date() } },
      session
    );
  }
}

// Export singleton instance
export const expenseRepository = new ExpenseRepository();
