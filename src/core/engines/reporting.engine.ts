import mongoose from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { JournalEntryModel } from "@/infrastructure/database/models/JournalEntry";

export class ReportingEngine {
  static async getLedgerBalances(companyId: string, asOfDate: Date, accountTypes: string[]) {
    await connectToDatabase();

    // Aggregation pipeline to quickly sum debits/credits to find current balances
    const pipeline = [
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          date: { $lte: asOfDate },
          status: "POSTED"
        }
      },
      { $unwind: "$lines" },
      {
        $lookup: {
          from: "chartofaccounts",
          localField: "lines.accountId",
          foreignField: "_id",
          as: "account"
        }
      },
      { $unwind: "$account" },
      {
        $match: {
          "account.type": { $in: accountTypes }
        }
      },
      {
        $group: {
          _id: "$account._id",
          code: { $first: "$account.code" },
          name: { $first: "$account.name" },
          type: { $first: "$account.type" },
          totalDebit: { $sum: "$lines.debit" },
          totalCredit: { $sum: "$lines.credit" }
        }
      }
    ];

    const results = await JournalEntryModel.aggregate(pipeline);

    return results.map(row => {
      // Asset/Expense normally Debit balances (Debit - Credit)
      // Liability/Equity/Revenue normally Credit balances (Credit - Debit)
      let balance = 0;
      if (["ASSET", "EXPENSE"].includes(row.type)) {
        balance = parseFloat(row.totalDebit.toString()) - parseFloat(row.totalCredit.toString());
      } else {
        balance = parseFloat(row.totalCredit.toString()) - parseFloat(row.totalDebit.toString());
      }
      return { ...row, balance };
    });
  }

  static async generateBalanceSheet(companyId: string, asOfDate: Date) {
    const balances = await this.getLedgerBalances(companyId, asOfDate, ["ASSET", "LIABILITY", "EQUITY"]);

    const assets = balances.filter(b => b.type === "ASSET");
    const liabilities = balances.filter(b => b.type === "LIABILITY");
    const equity = balances.filter(b => b.type === "EQUITY");

    const totalAssets = assets.reduce((sum, b) => sum + b.balance, 0);
    const totalLiablities = liabilities.reduce((sum, b) => sum + b.balance, 0);
    const totalEquity = equity.reduce((sum, b) => sum + b.balance, 0);

    return { totalAssets, totalLiablities, totalEquity, assets, liabilities, equity };
  }

  static async generateProfitAndLoss(companyId: string, startDate: Date, endDate: Date) {
    // Current getLedgerBalances is cumulative. For P&L we usually want period range.
    // For MVP we'll treat endDate balances as enough since we don't have year-end closing yet.
    const balances = await this.getLedgerBalances(companyId, endDate, ["REVENUE", "EXPENSE"]);

    const revenueItems = balances.filter(b => b.type === "REVENUE");
    const expenseItems = balances.filter(b => b.type === "EXPENSE");

    const revenue = revenueItems.reduce((sum, b) => sum + b.balance, 0);
    const expenses = expenseItems.reduce((sum, b) => sum + b.balance, 0);

    return { revenue, expenses, netProfit: revenue - expenses, revenueItems, expenseItems };
  }

  static async getDashboardMetrics(companyId: string) {
    const today = new Date();
    const pl = await this.generateProfitAndLoss(companyId, new Date(today.getFullYear(), 0, 1), today);
    const bs = await this.generateBalanceSheet(companyId, today);

    return {
      revenue: pl.revenue,
      expenses: pl.expenses,
      netProfit: pl.netProfit,
      totalAssets: bs.totalAssets,
      cashPosition: bs.assets.find(a => a.code === "1100")?.balance || 0
    };
  }

  /**
   * Generate Trial Balance report
   * Shows all accounts with their debit and credit balances
   */
  static async generateTrialBalance(companyId: string, asOfDate: Date) {
    await connectToDatabase();

    const pipeline = [
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          date: { $lte: asOfDate },
          status: "POSTED"
        }
      },
      { $unwind: "$lines" },
      {
        $lookup: {
          from: "chartofaccounts",
          localField: "lines.accountId",
          foreignField: "_id",
          as: "account"
        }
      },
      { $unwind: "$account" },
      {
        $group: {
          _id: "$account._id",
          code: { $first: "$account.code" },
          name: { $first: "$account.name" },
          type: { $first: "$account.type" },
          totalDebit: { $sum: "$lines.debit" },
          totalCredit: { $sum: "$lines.credit" }
        }
      },
      {
        $sort: { code: 1 }
      }
    ];

    const results = await JournalEntryModel.aggregate(pipeline);

    // Calculate balances - for trial balance we show the final position
    const accounts = results.map(row => {
      const debit = parseFloat(row.totalDebit?.toString() || "0");
      const credit = parseFloat(row.totalCredit?.toString() || "0");
      
      // Determine which column should show the balance based on account type
      // Debit balance accounts: Asset, Expense
      // Credit balance accounts: Liability, Equity, Revenue
      let debitBalance = 0;
      let creditBalance = 0;
      
      if (["ASSET", "EXPENSE"].includes(row.type)) {
        const net = debit - credit;
        if (net >= 0) {
          debitBalance = net;
        } else {
          creditBalance = Math.abs(net);
        }
      } else {
        const net = credit - debit;
        if (net >= 0) {
          creditBalance = net;
        } else {
          debitBalance = Math.abs(net);
        }
      }

      return {
        code: row.code,
        name: row.name,
        type: row.type,
        debitBalance,
        creditBalance,
      };
    });

    // Calculate totals
    const totalDebit = accounts.reduce((sum, acc) => sum + acc.debitBalance, 0);
    const totalCredit = accounts.reduce((sum, acc) => sum + acc.creditBalance, 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    return {
      asOfDate,
      accounts,
      totalDebit,
      totalCredit,
      isBalanced,
      variance: totalDebit - totalCredit
    };
  }

  /**
   * Generate Cash Flow Statement
   * Based on changes in account balances
   */
  static async generateCashFlowStatement(companyId: string, startDate: Date, endDate: Date) {
    await connectToDatabase();

    // Get cash and bank account codes
    const cashAccounts = ["1100", "1101", "1102"]; // Bank, Petty Cash, etc.

    const pipeline = [
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          date: { $gte: startDate, $lte: endDate },
          status: "POSTED"
        }
      },
      { $unwind: "$lines" },
      {
        $lookup: {
          from: "chartofaccounts",
          localField: "lines.accountId",
          foreignField: "_id",
          as: "account"
        }
      },
      { $unwind: "$account" },
      {
        $group: {
          _id: {
            accountId: "$account._id",
            source: "$source"
          },
          code: { $first: "$account.code" },
          name: { $first: "$account.name" },
          type: { $first: "$account.type" },
          totalDebit: { $sum: "$lines.debit" },
          totalCredit: { $sum: "$lines.credit" }
        }
      }
    ];

    const results = await JournalEntryModel.aggregate(pipeline);

    // Group by cash flow category
    const operatingItems: { description: string; amount: number }[] = [];
    const investingItems: { description: string; amount: number }[] = [];
    const financingItems: { description: string; amount: number }[] = [];

    // Calculate cash movements
    results.forEach(row => {
      const code = row.code;
      const debit = parseFloat(row.totalDebit?.toString() || "0");
      const credit = parseFloat(row.totalCredit?.toString() || "0");

      // Cash account movements
      if (cashAccounts.includes(code)) {
        // Cash movements based on source
        const source = row._id.source;
        const netChange = debit - credit;

        if (["REVENUE", "EXPENSE", "PAYROLL"].includes(source)) {
          operatingItems.push({
            description: `${source}: ${row.name}`,
            amount: netChange
          });
        } else if (["ASSET_PURCHASE", "ASSET_SALE"].includes(source)) {
          investingItems.push({
            description: `${source}: ${row.name}`,
            amount: netChange
          });
        } else if (["LOAN", "EQUITY", "DIVIDEND"].includes(source)) {
          financingItems.push({
            description: `${source}: ${row.name}`,
            amount: netChange
          });
        } else {
          // Default to operating
          operatingItems.push({
            description: `${source || "OTHER"}: ${row.name}`,
            amount: netChange
          });
        }
      }
    });

    const operatingTotal = operatingItems.reduce((sum, item) => sum + item.amount, 0);
    const investingTotal = investingItems.reduce((sum, item) => sum + item.amount, 0);
    const financingTotal = financingItems.reduce((sum, item) => sum + item.amount, 0);
    const netCashChange = operatingTotal + investingTotal + financingTotal;

    // Get opening and closing cash balance
    const openingPipeline = [
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          date: { $lt: startDate },
          status: "POSTED"
        }
      },
      { $unwind: "$lines" },
      {
        $lookup: {
          from: "chartofaccounts",
          localField: "lines.accountId",
          foreignField: "_id",
          as: "account"
        }
      },
      { $unwind: "$account" },
      {
        $match: {
          "account.code": { $in: cashAccounts }
        }
      },
      {
        $group: {
          _id: null,
          totalDebit: { $sum: "$lines.debit" },
          totalCredit: { $sum: "$lines.credit" }
        }
      }
    ];

    const openingResult = await JournalEntryModel.aggregate(openingPipeline);
    const openingBalance = openingResult.length > 0 
      ? parseFloat(openingResult[0].totalDebit?.toString() || "0") - parseFloat(openingResult[0].totalCredit?.toString() || "0")
      : 0;

    const closingBalance = openingBalance + netCashChange;

    return {
      startDate,
      endDate,
      operating: {
        items: operatingItems,
        total: operatingTotal
      },
      investing: {
        items: investingItems,
        total: investingTotal
      },
      financing: {
        items: financingItems,
        total: financingTotal
      },
      netCashChange,
      openingBalance,
      closingBalance
    };
  }
}
