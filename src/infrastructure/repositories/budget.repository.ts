import mongoose, { ClientSession } from "mongoose";
import { BaseRepository } from "./base.repository";
import { BudgetModel, IBudget } from "@/infrastructure/database/models/Budget";

export class BudgetRepository extends BaseRepository<IBudget> {
  constructor() {
    super(BudgetModel);
  }

  /**
   * Find budgets by fiscal year
   */
  async findByFiscalYear(
    companyId: string,
    fiscalYear: number,
    session?: ClientSession
  ): Promise<IBudget[]> {
    return this.find(companyId, { fiscalYear }, { sort: { periodNumber: 1 }, session });
  }

  /**
   * Find active budgets
   */
  async findActive(companyId: string, session?: ClientSession): Promise<IBudget[]> {
    return this.find(companyId, { status: "ACTIVE" }, { session });
  }

  /**
   * Find budgets by department
   */
  async findByDepartment(
    companyId: string,
    departmentId: string,
    session?: ClientSession
  ): Promise<IBudget[]> {
    return this.find(
      companyId,
      { departmentId: new mongoose.Types.ObjectId(departmentId) },
      { sort: { fiscalYear: -1 }, session }
    );
  }

  /**
   * Update budget status
   */
  async updateStatus(
    companyId: string,
    budgetId: string,
    status: IBudget["status"],
    approvedBy?: string,
    session?: ClientSession
  ): Promise<IBudget | null> {
    const update: Record<string, unknown> = { status };
    if (status === "APPROVED" && approvedBy) {
      update.approvedBy = new mongoose.Types.ObjectId(approvedBy);
      update.approvedAt = new Date();
    }
    return this.updateById(companyId, budgetId, { $set: update }, session);
  }

  /**
   * Get budget utilization summary
   */
  async getBudgetUtilization(
    companyId: string,
    fiscalYear: number,
    session?: ClientSession
  ): Promise<{ totalBudgeted: number; budgetCount: number }> {
    await this.ensureConnection();

    const result = await BudgetModel.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          fiscalYear,
          status: "ACTIVE",
        },
      },
      {
        $group: {
          _id: null,
          totalBudgeted: { $sum: { $toDouble: "$totalAmount" } },
          budgetCount: { $sum: 1 },
        },
      },
    ]).session(session || null);

    return result[0] || { totalBudgeted: 0, budgetCount: 0 };
  }
}

export const budgetRepository = new BudgetRepository();
