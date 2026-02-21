import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { JournalEntryModel, IJournalEntry } from "@/infrastructure/database/models/JournalEntry";
import mongoose from "mongoose";

export class JournalRepository {
  static async createJournal(data: Partial<IJournalEntry>, session?: mongoose.ClientSession): Promise<IJournalEntry> {
    await connectToDatabase();
    const journal = new JournalEntryModel(data);
    return await journal.save({ session });
  }

  static async getJournalsByCompany(companyId: string, limit = 50, skip = 0) {
    await connectToDatabase();
    return await JournalEntryModel.find({ companyId })
      .populate("lines.accountId")
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  static async generateJournalNo(companyId: string, session?: mongoose.ClientSession): Promise<string> {
    await connectToDatabase();
    const prefix = `JV-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, "0")}`;
    const query = JournalEntryModel.findOne({ companyId, journalNo: new RegExp(`^${prefix}`) })
      .sort({ journalNo: -1 })
      .select("journalNo");

    if (session) {
      query.session(session);
    }

    const lastJournal = await query.exec();

    let nextNum = 1;
    if (lastJournal && lastJournal.journalNo) {
      const lastNum = parseInt(lastJournal.journalNo.split("-")[2], 10);
      nextNum = lastNum + 1;
    }
    return `${prefix}-${nextNum.toString().padStart(4, "0")}`;
  }
}
