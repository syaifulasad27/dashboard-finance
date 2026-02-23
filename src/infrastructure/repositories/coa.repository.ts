import mongoose, { ClientSession } from "mongoose";
import { BaseRepository } from "./base.repository";
import { ChartOfAccountModel, IChartOfAccount } from "@/infrastructure/database/models/ChartOfAccount";

export class ChartOfAccountRepository extends BaseRepository<IChartOfAccount> {
  constructor() {
    super(ChartOfAccountModel);
  }

  /**
   * Find account by code
   */
  async findByCode(
    companyId: string,
    code: string,
    session?: ClientSession
  ): Promise<IChartOfAccount | null> {
    return this.findOne(companyId, { code }, { session });
  }

  /**
   * Find accounts by type
   */
  async findByType(
    companyId: string,
    type: IChartOfAccount["type"],
    session?: ClientSession
  ): Promise<IChartOfAccount[]> {
    return this.find(companyId, { type, isActive: true }, { sort: { code: 1 }, session });
  }

  /**
   * Find all active accounts
   */
  async findAllActive(
    companyId: string,
    session?: ClientSession
  ): Promise<IChartOfAccount[]> {
    return this.find(companyId, { isActive: true }, { sort: { code: 1 }, session });
  }

  /**
   * Find children accounts
   */
  async findChildren(
    companyId: string,
    parentId: string,
    session?: ClientSession
  ): Promise<IChartOfAccount[]> {
    return this.find(
      companyId,
      { parentId: new mongoose.Types.ObjectId(parentId), isActive: true },
      { sort: { code: 1 }, session }
    );
  }

  /**
   * Find root accounts (no parent)
   */
  async findRootAccounts(
    companyId: string,
    session?: ClientSession
  ): Promise<IChartOfAccount[]> {
    return this.find(
      companyId,
      { parentId: { $exists: false }, isActive: true },
      { sort: { code: 1 }, session }
    );
  }

  /**
   * Get required accounts for journal posting
   * Returns commonly used accounts (Bank, Revenue, Expense, Tax Payable)
   */
  async getRequiredAccounts(
    companyId: string,
    codes: string[],
    session?: ClientSession
  ): Promise<Map<string, IChartOfAccount>> {
    const accounts = await this.find(
      companyId,
      { code: { $in: codes }, isActive: true },
      { session }
    );

    const accountMap = new Map<string, IChartOfAccount>();
    for (const account of accounts) {
      accountMap.set(account.code, account);
    }

    return accountMap;
  }

  /**
   * Deactivate account (soft delete)
   */
  async deactivate(
    companyId: string,
    accountId: string,
    session?: ClientSession
  ): Promise<IChartOfAccount | null> {
    return this.updateById(companyId, accountId, { $set: { isActive: false } }, session);
  }
}

// Export singleton instance
export const chartOfAccountRepository = new ChartOfAccountRepository();
