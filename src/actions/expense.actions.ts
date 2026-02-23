"use server";

import { revalidatePath } from "next/cache";
import { AccountingEngine } from "@/core/engines/accounting.engine";
import { expenseRepository } from "@/infrastructure/repositories/expense.repository";
import { chartOfAccountRepository } from "@/infrastructure/repositories/coa.repository";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { logAction } from "@/lib/logger";
import { requireAuth, AuthorizationError, ForbiddenError } from "@/lib/session";
import { requirePermission, checkPermission } from "@/lib/permissions";

const expenseSchema = z.object({
  vendor: z.string().min(2),
  category: z.string().min(2),
  amount: z.number().positive(),
  tax: z.number().min(0).default(0),
  date: z.string(),
});

export async function createExpense(formData: FormData) {
  try {
    // 1. Authenticate and get session context
    const session = await requireAuth();
    
    // 2. Check permission
    requirePermission(session, "EXPENSE", "CREATE");

    await connectToDatabase();

    const parsed = expenseSchema.parse({
      vendor: formData.get("vendor"),
      category: formData.get("category"),
      amount: parseFloat(formData.get("amount") as string),
      tax: parseFloat(formData.get("tax") as string || "0"),
      date: formData.get("date"),
    });

    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
      // Determine initial approval status based on user's permission
      // Users who can approve get auto-approved, others start as PENDING
      const canApprove = checkPermission(session, "EXPENSE", "APPROVE");
      const initialStatus = canApprove ? "APPROVED" : "PENDING";

      // 1. Save expense record using repository
      const expense = await expenseRepository.create(
        session.companyId,
        {
          vendor: parsed.vendor,
          category: parsed.category,
          amount: mongoose.Types.Decimal128.fromString(parsed.amount.toString()),
          tax: mongoose.Types.Decimal128.fromString(parsed.tax.toString()),
          approvalStatus: initialStatus,
          date: new Date(parsed.date),
          createdBy: new mongoose.Types.ObjectId(session.userId),
        },
        dbSession
      );

      // 2. Only create journal if expense is approved
      if (initialStatus === "APPROVED") {
        const accounts = await chartOfAccountRepository.getRequiredAccounts(
          session.companyId,
          ["1100", "5100"],
          dbSession
        );

        const bankAccount = accounts.get("1100");
        const expenseAccount = accounts.get("5100");

        if (!bankAccount || !expenseAccount) {
          throw new Error("Missing required Chart of Accounts (1100, 5100) for generating Expense Journal.");
        }

        const journal = await AccountingEngine.recordTransaction({
          companyId: session.companyId,
          date: new Date(parsed.date),
          description: `Expense ${parsed.category} - Vendor: ${parsed.vendor}`,
          source: "EXPENSE",
          lines: [
            { accountId: expenseAccount._id.toString(), debit: parsed.amount + parsed.tax, credit: 0 },
            { accountId: bankAccount._id.toString(), debit: 0, credit: parsed.amount + parsed.tax },
          ],
          createdBy: session.userId
        }, dbSession);

        await expenseRepository.linkJournal(
          session.companyId,
          expense._id.toString(),
          journal._id!.toString(),
          dbSession
        );
      }

      // 3. Audit Logging
      await logAction({
        companyId: session.companyId,
        userId: session.userId,
        action: "CREATE",
        module: "EXPENSE",
        resourceId: expense._id.toString(),
        newValue: { ...parsed, approvalStatus: initialStatus }
      }, dbSession);

      await dbSession.commitTransaction();
    } catch (e) {
      await dbSession.abortTransaction();
      throw e;
    } finally {
      dbSession.endSession();
    }

    revalidatePath("/dashboard/expense");
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
 * Approve a pending expense
 */
export async function approveExpense(expenseId: string) {
  try {
    const session = await requireAuth();
    requirePermission(session, "EXPENSE", "APPROVE");

    await connectToDatabase();

    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
      // Get the expense
      const expense = await expenseRepository.findById(session.companyId, expenseId, { session: dbSession });
      
      if (!expense) {
        throw new Error("Expense not found");
      }

      if (expense.approvalStatus !== "PENDING") {
        throw new Error("Only pending expenses can be approved");
      }

      // Approve expense
      await expenseRepository.approve(session.companyId, expenseId, dbSession);

      // Create journal for the approved expense
      const accounts = await chartOfAccountRepository.getRequiredAccounts(
        session.companyId,
        ["1100", "5100"],
        dbSession
      );

      const bankAccount = accounts.get("1100");
      const expenseAccount = accounts.get("5100");

      if (!bankAccount || !expenseAccount) {
        throw new Error("Missing required Chart of Accounts");
      }

      const amount = parseFloat(expense.amount.toString());
      const tax = parseFloat(expense.tax?.toString() || "0");

      const journal = await AccountingEngine.recordTransaction({
        companyId: session.companyId,
        date: expense.date,
        description: `Expense ${expense.category} - Vendor: ${expense.vendor}`,
        source: "EXPENSE",
        lines: [
          { accountId: expenseAccount._id.toString(), debit: amount + tax, credit: 0 },
          { accountId: bankAccount._id.toString(), debit: 0, credit: amount + tax },
        ],
        createdBy: session.userId
      }, dbSession);

      await expenseRepository.linkJournal(
        session.companyId,
        expenseId,
        journal._id!.toString(),
        dbSession
      );

      await logAction({
        companyId: session.companyId,
        userId: session.userId,
        action: "APPROVE",
        module: "EXPENSE",
        resourceId: expenseId,
        oldValue: { approvalStatus: "PENDING" },
        newValue: { approvalStatus: "APPROVED" }
      }, dbSession);

      await dbSession.commitTransaction();
    } catch (e) {
      await dbSession.abortTransaction();
      throw e;
    } finally {
      dbSession.endSession();
    }

    revalidatePath("/dashboard/expense");
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
 * Reject a pending expense
 */
export async function rejectExpense(expenseId: string) {
  try {
    const session = await requireAuth();
    requirePermission(session, "EXPENSE", "APPROVE");

    await connectToDatabase();

    const expense = await expenseRepository.findById(session.companyId, expenseId);
    
    if (!expense) {
      throw new Error("Expense not found");
    }

    if (expense.approvalStatus !== "PENDING") {
      throw new Error("Only pending expenses can be rejected");
    }

    await expenseRepository.reject(session.companyId, expenseId);

    await logAction({
      companyId: session.companyId,
      userId: session.userId,
      action: "REJECT",
      module: "EXPENSE",
      resourceId: expenseId,
      oldValue: { approvalStatus: "PENDING" },
      newValue: { approvalStatus: "REJECTED" }
    });

    revalidatePath("/dashboard/expense");
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
 * Void an approved expense - creates reversing journal entry
 */
export async function voidExpense(expenseId: string, reason: string) {
  try {
    const session = await requireAuth();
    requirePermission(session, "EXPENSE", "APPROVE"); // Same permission as approve

    await connectToDatabase();

    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
      const expense = await expenseRepository.findById(session.companyId, expenseId, { session: dbSession });
      
      if (!expense) {
        throw new Error("Expense not found");
      }

      if (expense.approvalStatus !== "APPROVED") {
        throw new Error("Only approved expenses can be voided");
      }

      // Create reversing journal entry if original journal exists
      if (expense.journalId) {
        const accounts = await chartOfAccountRepository.getRequiredAccounts(
          session.companyId,
          ["1100", "5100"],
          dbSession
        );

        const bankAccount = accounts.get("1100");
        const expenseAccount = accounts.get("5100");

        if (bankAccount && expenseAccount) {
          const amount = parseFloat(expense.amount.toString());
          const tax = parseFloat(expense.tax?.toString() || "0");

          // Create reversing entry (opposite of original)
          await AccountingEngine.recordTransaction({
            companyId: session.companyId,
            date: new Date(),
            description: `VOID: Expense ${expense.category} - Vendor: ${expense.vendor} - ${reason}`,
            source: "EXPENSE",
            lines: [
              { accountId: bankAccount._id.toString(), debit: amount + tax, credit: 0 },
              { accountId: expenseAccount._id.toString(), debit: 0, credit: amount + tax },
            ],
            createdBy: session.userId
          }, dbSession);
        }
      }

      // Mark expense as voided
      await expenseRepository.void(session.companyId, expenseId, reason, dbSession);

      await logAction({
        companyId: session.companyId,
        userId: session.userId,
        action: "VOID",
        module: "EXPENSE",
        resourceId: expenseId,
        oldValue: { approvalStatus: "APPROVED" },
        newValue: { approvalStatus: "VOIDED", voidReason: reason }
      }, dbSession);

      await dbSession.commitTransaction();
    } catch (e) {
      await dbSession.abortTransaction();
      throw e;
    } finally {
      dbSession.endSession();
    }

    revalidatePath("/dashboard/expense");
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