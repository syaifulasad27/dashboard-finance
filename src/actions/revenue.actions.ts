"use server";

import { revalidatePath } from "next/cache";
import { AccountingEngine } from "@/core/engines/accounting.engine";
import { revenueRepository } from "@/infrastructure/repositories/revenue.repository";
import { chartOfAccountRepository } from "@/infrastructure/repositories/coa.repository";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { logAction } from "@/lib/logger";
import { requireAuth, AuthorizationError, ForbiddenError } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";

const revenueSchema = z.object({
  source: z.string().min(2),
  customer: z.string().min(2),
  invoiceNumber: z.string().min(2),
  amount: z.number().positive(),
  tax: z.number().min(0).default(0),
  paymentMethod: z.enum(["BANK_TRANSFER", "CASH", "CREDIT_CARD"]),
  date: z.string(),
});

export async function createRevenue(formData: FormData) {
  try {
    // 1. Authenticate and get session context
    const session = await requireAuth();
    
    // 2. Check permission
    requirePermission(session, "REVENUE", "CREATE");

    await connectToDatabase();

    const parsed = revenueSchema.parse({
      source: formData.get("source"),
      customer: formData.get("customer"),
      invoiceNumber: formData.get("invoiceNumber"),
      amount: parseFloat(formData.get("amount") as string),
      tax: parseFloat(formData.get("tax") as string || "0"),
      paymentMethod: formData.get("paymentMethod"),
      date: formData.get("date"),
    });

    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
      // 1. Save revenue record using repository
      const revenue = await revenueRepository.create(
        session.companyId,
        {
          source: parsed.source,
          customer: parsed.customer,
          invoiceNumber: parsed.invoiceNumber,
          amount: mongoose.Types.Decimal128.fromString(parsed.amount.toString()),
          tax: mongoose.Types.Decimal128.fromString(parsed.tax.toString()),
          paymentMethod: parsed.paymentMethod,
          date: new Date(parsed.date),
          createdBy: new mongoose.Types.ObjectId(session.userId),
        },
        dbSession
      );

      // 2. Get required accounts for journal posting
      const accounts = await chartOfAccountRepository.getRequiredAccounts(
        session.companyId,
        ["1100", "4000", "2100"], // Bank, Revenue, Tax Payable
        dbSession
      );

      const bankAccount = accounts.get("1100");
      const revAccount = accounts.get("4000");
      const taxPayableAccount = accounts.get("2100");

      if (!bankAccount || !revAccount) {
        throw new Error("Missing required Chart of Accounts (1100, 4000) for generating Revenue Journal.");
      }

      // 3. Build journal lines (include tax if applicable)
      const journalLines = [
        { accountId: bankAccount._id.toString(), debit: parsed.amount + parsed.tax, credit: 0 },
        { accountId: revAccount._id.toString(), debit: 0, credit: parsed.amount },
      ];

      // Add tax payable line if tax > 0
      if (parsed.tax > 0 && taxPayableAccount) {
        journalLines.push({ accountId: taxPayableAccount._id.toString(), debit: 0, credit: parsed.tax });
      }

      const journal = await AccountingEngine.recordTransaction({
        companyId: session.companyId,
        date: new Date(parsed.date),
        description: `Revenue via ${parsed.source} - Inv: ${parsed.invoiceNumber}`,
        source: "REVENUE",
        lines: journalLines,
        createdBy: session.userId
      }, dbSession);

      // 4. Link journal to revenue
      await revenueRepository.linkJournal(
        session.companyId,
        revenue._id.toString(),
        journal._id!.toString(),
        dbSession
      );

      // 5. Audit Logging
      await logAction({
        companyId: session.companyId,
        userId: session.userId,
        action: "CREATE",
        module: "REVENUE",
        resourceId: revenue._id.toString(),
        newValue: parsed
      }, dbSession);

      await dbSession.commitTransaction();
    } catch (e) {
      await dbSession.abortTransaction();
      throw e;
    } finally {
      dbSession.endSession();
    }

    revalidatePath("/revenue");
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
 * Void a revenue entry - creates reversing journal entry
 */
export async function voidRevenue(revenueId: string, reason: string) {
  try {
    const session = await requireAuth();
    requirePermission(session, "REVENUE", "APPROVE"); // Requires approval permission

    await connectToDatabase();

    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
      const revenue = await revenueRepository.findById(session.companyId, revenueId, { session: dbSession });
      
      if (!revenue) {
        throw new Error("Revenue record not found");
      }

      if (revenue.status === "VOID") {
        throw new Error("Revenue is already voided");
      }

      // Create reversing journal entry if original journal exists
      if (revenue.journalId) {
        const accounts = await chartOfAccountRepository.getRequiredAccounts(
          session.companyId,
          ["1100", "4000", "2100"],
          dbSession
        );

        const bankAccount = accounts.get("1100");
        const revAccount = accounts.get("4000");
        const taxPayableAccount = accounts.get("2100");

        if (bankAccount && revAccount) {
          const amount = parseFloat(revenue.amount.toString());
          const tax = parseFloat(revenue.tax?.toString() || "0");

          // Build reversing journal lines (opposite of original)
          const journalLines = [
            { accountId: revAccount._id.toString(), debit: amount, credit: 0 },
            { accountId: bankAccount._id.toString(), debit: 0, credit: amount + tax },
          ];

          if (tax > 0 && taxPayableAccount) {
            journalLines.push({ accountId: taxPayableAccount._id.toString(), debit: tax, credit: 0 });
          }

          await AccountingEngine.recordTransaction({
            companyId: session.companyId,
            date: new Date(),
            description: `VOID: Revenue ${revenue.source} - Inv: ${revenue.invoiceNumber} - ${reason}`,
            source: "REVENUE",
            lines: journalLines,
            createdBy: session.userId
          }, dbSession);
        }
      }

      // Mark revenue as voided
      await revenueRepository.void(session.companyId, revenueId, dbSession);

      await logAction({
        companyId: session.companyId,
        userId: session.userId,
        action: "VOID",
        module: "REVENUE",
        resourceId: revenueId,
        oldValue: { status: revenue.status },
        newValue: { status: "VOID", voidReason: reason }
      }, dbSession);

      await dbSession.commitTransaction();
    } catch (e) {
      await dbSession.abortTransaction();
      throw e;
    } finally {
      dbSession.endSession();
    }

    revalidatePath("/revenue");
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
