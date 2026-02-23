"use server";

import { revalidatePath } from "next/cache";
import { AccountingEngine } from "@/core/engines/accounting.engine";
import { journalRepository } from "@/infrastructure/repositories/journal.repository";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { requireAuth, AuthorizationError, ForbiddenError } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/logger";

const journalSchema = z.object({
  description: z.string().min(3),
  date: z.string(),
  lines: z.array(z.object({
    accountId: z.string(),
    debit: z.string().or(z.number()),
    credit: z.string().or(z.number()),
  })).min(2),
});

export async function createManualJournal(formData: FormData) {
  try {
    // 1. Authenticate and get session context
    const session = await requireAuth();
    
    // 2. Check permission
    requirePermission(session, "JOURNAL", "CREATE");

    await connectToDatabase();

    const description = formData.get("description") as string;
    const date = new Date(formData.get("date") as string);
    const rawLines = JSON.parse(formData.get("lines") as string);

    const parsed = journalSchema.parse({ description, date: date.toISOString(), lines: rawLines });

    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
      const journal = await AccountingEngine.recordTransaction({
        companyId: session.companyId,
        date,
        description: parsed.description,
        source: "MANUAL",
        lines: parsed.lines,
        createdBy: session.userId
      }, dbSession);

      // Audit log
      await logAction({
        companyId: session.companyId,
        userId: session.userId,
        action: "CREATE",
        module: "JOURNAL",
        resourceId: journal._id?.toString(),
        newValue: { description: parsed.description, linesCount: parsed.lines.length }
      }, dbSession);

      await dbSession.commitTransaction();
    } catch (e) {
      await dbSession.abortTransaction();
      throw e;
    } finally {
      dbSession.endSession();
    }

    revalidatePath("/dashboard/journal");
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: "Please log in to continue" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: error.message };
  }
}

/**
 * Reverse a posted journal entry by creating a new journal with swapped debits/credits
 */
export async function reverseJournal(journalId: string, reversalDate?: string) {
  try {
    const session = await requireAuth();
    requirePermission(session, "JOURNAL", "CREATE");

    await connectToDatabase();

    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
      // Get the original journal
      const originalJournal = await journalRepository.findById(
        session.companyId,
        journalId,
        { session: dbSession }
      );

      if (!originalJournal) {
        throw new Error("Journal not found");
      }

      if (originalJournal.status !== "POSTED") {
        throw new Error("Only POSTED journals can be reversed");
      }

      // Create reversing entries by swapping debits and credits
      const reversingLines = originalJournal.lines.map((line: any) => ({
        accountId: line.accountId.toString(),
        debit: parseFloat(line.credit?.toString() || "0"),
        credit: parseFloat(line.debit?.toString() || "0"),
      }));

      // Generate new journal number
      const journalNo = await journalRepository.generateJournalNo(session.companyId, dbSession);

      // Create the reversing journal
      const reversingJournal = await AccountingEngine.recordTransaction({
        companyId: session.companyId,
        date: reversalDate ? new Date(reversalDate) : new Date(),
        description: `REVERSAL: ${originalJournal.description} (Original: ${originalJournal.journalNo})`,
        source: "MANUAL",
        lines: reversingLines,
        createdBy: session.userId,
      }, dbSession);

      await logAction({
        companyId: session.companyId,
        userId: session.userId,
        action: "REVERSE",
        module: "JOURNAL",
        resourceId: journalId,
        oldValue: { journalNo: originalJournal.journalNo },
        newValue: { reversingJournalNo: reversingJournal.journalNo }
      }, dbSession);

      await dbSession.commitTransaction();
      return { success: true, reversingJournalId: reversingJournal._id?.toString() };
    } catch (e) {
      await dbSession.abortTransaction();
      throw e;
    } finally {
      dbSession.endSession();
    }
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: "Please log in to continue" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: error.message };
  }
}

/**
 * Void a journal entry (mark as voided - no reversing entry, used for corrections)
 */
export async function voidJournal(journalId: string) {
  try {
    const session = await requireAuth();
    requirePermission(session, "JOURNAL", "APPROVE"); // Requires approval permission to void

    await connectToDatabase();

    const journal = await journalRepository.findById(session.companyId, journalId);

    if (!journal) {
      throw new Error("Journal not found");
    }

    if (journal.status === "VOID") {
      throw new Error("Journal is already voided");
    }

    await journalRepository.voidJournal(session.companyId, journalId);

    await logAction({
      companyId: session.companyId,
      userId: session.userId,
      action: "VOID",
      module: "JOURNAL",
      resourceId: journalId,
      oldValue: { status: journal.status },
      newValue: { status: "VOID" }
    });

    revalidatePath("/dashboard/journal");
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: "Please log in to continue" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: error.message };
  }
}

/**
 * Post a draft journal entry
 */
export async function postJournal(journalId: string) {
  try {
    const session = await requireAuth();
    requirePermission(session, "JOURNAL", "APPROVE");

    await connectToDatabase();

    const journal = await journalRepository.findById(session.companyId, journalId);

    if (!journal) {
      throw new Error("Journal not found");
    }

    if (journal.status !== "DRAFT") {
      throw new Error("Only draft journals can be posted");
    }

    await journalRepository.postJournal(session.companyId, journalId);

    await logAction({
      companyId: session.companyId,
      userId: session.userId,
      action: "POST",
      module: "JOURNAL",
      resourceId: journalId,
      oldValue: { status: "DRAFT" },
      newValue: { status: "POSTED" }
    });

    revalidatePath("/dashboard/journal");
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: "Please log in to continue" };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: error.message };
  }
}