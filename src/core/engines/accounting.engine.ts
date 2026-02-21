import Decimal from "decimal.js";
import { JournalRepository } from "@/infrastructure/repositories/journal.repository";
import mongoose from "mongoose";

export interface CreateJournalConfig {
  companyId: string;
  date: Date;
  description: string;
  source: "MANUAL" | "PAYROLL" | "REVENUE" | "EXPENSE" | "TAX";
  lines: Array<{
    accountId: string;
    debit: string | number;
    credit: string | number;
    description?: string;
  }>;
  createdBy: string;
}

export class AccountingEngine {
  static validateBalance(lines: CreateJournalConfig["lines"]): boolean {
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const line of lines) {
      totalDebit = totalDebit.plus(new Decimal(line.debit));
      totalCredit = totalCredit.plus(new Decimal(line.credit));
    }

    return totalDebit.equals(totalCredit);
  }

  static async recordTransaction(config: CreateJournalConfig, session?: mongoose.ClientSession) {
    if (!this.validateBalance(config.lines)) {
      throw new Error("Journal entries must be balanced (Total Debit = Total Credit)");
    }

    const journalNo = await JournalRepository.generateJournalNo(config.companyId, session);

    const journalData = {
      companyId: new mongoose.Types.ObjectId(config.companyId),
      journalNo,
      date: config.date,
      description: config.description,
      source: config.source,
      status: "POSTED" as const,
      createdBy: new mongoose.Types.ObjectId(config.createdBy),
      lines: config.lines.map(line => ({
        accountId: new mongoose.Types.ObjectId(line.accountId),
        debit: mongoose.Types.Decimal128.fromString(new Decimal(line.debit).toString()),
        credit: mongoose.Types.Decimal128.fromString(new Decimal(line.credit).toString()),
        description: line.description,
      }))
    };

    return await JournalRepository.createJournal(journalData, session);
  }
}
