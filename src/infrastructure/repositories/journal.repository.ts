import mongoose, { ClientSession } from "mongoose";
import { BaseRepository } from "./base.repository";
import { JournalEntryModel, IJournalEntry } from "@/infrastructure/database/models/JournalEntry";
import "@/infrastructure/database/models/ChartOfAccount"; // Ensure model is registered for populate

export class JournalEntryRepository extends BaseRepository<IJournalEntry> {
  constructor() {
    super(JournalEntryModel);
  }

  /**
   * Create journal entry (DO NOT USE updateById for POSTED journals - immutability enforced)
   */
  async createJournal(
    companyId: string,
    data: Omit<IJournalEntry, "companyId" | "_id">,
    session?: ClientSession
  ): Promise<IJournalEntry> {
    return this.create(companyId, data, session);
  }

  /**
   * Get journals with populated account information
   */
  async getJournalsByCompany(
    companyId: string,
    limit: number = 50,
    skip: number = 0
  ): Promise<IJournalEntry[]> {
    return this.find(
      companyId,
      {},
      {
        limit,
        skip,
        sort: { date: -1 },
        populate: "lines.accountId"
      }
    );
  }

  /**
   * Find journals by date range
   */
  async findByDateRange(
    companyId: string,
    startDate: Date,
    endDate: Date,
    status?: IJournalEntry["status"],
    session?: ClientSession
  ): Promise<IJournalEntry[]> {
    const filter: any = { date: { $gte: startDate, $lte: endDate } };
    if (status) filter.status = status;

    return this.find(companyId, filter, { sort: { date: -1 }, session });
  }

  /**
   * Find posted journals only
   */
  async findPosted(
    companyId: string,
    startDate?: Date,
    endDate?: Date,
    session?: ClientSession
  ): Promise<IJournalEntry[]> {
    const filter: any = { status: "POSTED" };
    if (startDate && endDate) {
      filter.date = { $gte: startDate, $lte: endDate };
    }
    return this.find(companyId, filter, { sort: { date: -1 }, session });
  }

  /**
   * Generate next journal number
   */
  async generateJournalNo(companyId: string, session?: ClientSession): Promise<string> {
    await this.ensureConnection();

    const prefix = `JV-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, "0")}`;
    
    let query = JournalEntryModel.findOne({
      companyId: new mongoose.Types.ObjectId(companyId),
      journalNo: new RegExp(`^${prefix}`)
    })
      .sort({ journalNo: -1 })
      .select("journalNo");

    if (session) query = query.session(session);

    const lastJournal = await query.exec();

    let nextNum = 1;
    if (lastJournal?.journalNo) {
      const lastNum = parseInt(lastJournal.journalNo.split("-")[2], 10);
      nextNum = lastNum + 1;
    }

    return `${prefix}-${nextNum.toString().padStart(4, "0")}`;
  }

  /**
   * Post a draft journal (change status from DRAFT to POSTED)
   * Once posted, journal becomes immutable
   */
  async postJournal(
    companyId: string,
    journalId: string,
    session?: ClientSession
  ): Promise<IJournalEntry | null> {
    const journal = await this.findById(companyId, journalId, { session });
    
    if (!journal) {
      throw new Error("Journal not found");
    }
    
    if (journal.status !== "DRAFT") {
      throw new Error("Only DRAFT journals can be posted");
    }

    return this.updateById(companyId, journalId, { $set: { status: "POSTED" } }, session);
  }

  /**
   * Void a journal entry (creates immutability by changing status to VOID)
   * POSTED journals cannot be deleted or modified - only voided
   */
  async voidJournal(
    companyId: string,
    journalId: string,
    session?: ClientSession
  ): Promise<IJournalEntry | null> {
    const journal = await this.findById(companyId, journalId, { session });
    
    if (!journal) {
      throw new Error("Journal not found");
    }
    
    if (journal.status === "VOID") {
      throw new Error("Journal is already voided");
    }

    return this.updateById(companyId, journalId, { $set: { status: "VOID" } }, session);
  }

  /**
   * Override updateById to enforce immutability for POSTED journals
   */
  async updateById(
    companyId: string,
    id: string,
    update: any,
    session?: ClientSession
  ): Promise<IJournalEntry | null> {
    // Check if journal is posted - only allow status changes to VOID
    const existingJournal = await this.findById(companyId, id, { session });
    
    if (existingJournal?.status === "POSTED") {
      // Only allow changing status to VOID for posted journals
      const updateKeys = Object.keys(update.$set || update);
      const allowedUpdates = ["status"];
      const isStatusChangeToVoid = update.$set?.status === "VOID";
      
      const hasDisallowedChanges = updateKeys.some(key => !allowedUpdates.includes(key));
      
      if (hasDisallowedChanges || (update.$set?.status && !isStatusChangeToVoid)) {
        throw new Error("Cannot modify POSTED journal entries. Void and create a new entry instead.");
      }
    }

    return super.updateById(companyId, id, update, session);
  }
}

// Export singleton instance  
export const journalRepository = new JournalEntryRepository();

// Legacy export for backward compatibility (will be removed)
export const JournalRepository = {
  async createJournal(data: Partial<IJournalEntry>, session?: mongoose.ClientSession) {
    const companyId = data.companyId?.toString();
    if (!companyId) throw new Error("companyId is required");
    return journalRepository.createJournal(companyId, data as any, session);
  },
  
  async getJournalsByCompany(companyId: string, limit = 50, skip = 0) {
    return journalRepository.getJournalsByCompany(companyId, limit, skip);
  },
  
  async generateJournalNo(companyId: string, session?: mongoose.ClientSession) {
    return journalRepository.generateJournalNo(companyId, session);
  }
};
