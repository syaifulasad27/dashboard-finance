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
      if (["Asset", "Expense"].includes(row.type)) {
        balance = parseFloat(row.totalDebit.toString()) - parseFloat(row.totalCredit.toString());
      } else {
        balance = parseFloat(row.totalCredit.toString()) - parseFloat(row.totalDebit.toString());
      }
      return { ...row, balance };
    });
  }

  static async generateBalanceSheet(companyId: string, asOfDate: Date) {
    const balances = await this.getLedgerBalances(companyId, asOfDate, ["Asset", "Liability", "Equity"]);

    const assets = balances.filter(b => b.type === "Asset");
    const liabilities = balances.filter(b => b.type === "Liability");
    const equity = balances.filter(b => b.type === "Equity");

    const totalAssets = assets.reduce((sum, b) => sum + b.balance, 0);
    const totalLiablities = liabilities.reduce((sum, b) => sum + b.balance, 0);
    const totalEquity = equity.reduce((sum, b) => sum + b.balance, 0);

    return { totalAssets, totalLiablities, totalEquity, assets, liabilities, equity };
  }

  static async generateProfitAndLoss(companyId: string, startDate: Date, endDate: Date) {
    // Current getLedgerBalances is cumulative. For P&L we usually want period range.
    // For MVP we'll treat endDate balances as enough since we don't have year-end closing yet.
    const balances = await this.getLedgerBalances(companyId, endDate, ["Revenue", "Expense"]);

    const revenueItems = balances.filter(b => b.type === "Revenue");
    const expenseItems = balances.filter(b => b.type === "Expense");

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
}
