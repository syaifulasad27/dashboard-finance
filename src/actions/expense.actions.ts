"use server";

import { revalidatePath } from "next/cache";
import { AccountingEngine } from "@/core/engines/accounting.engine";
import { ExpenseModel } from "@/infrastructure/database/models/Expense";
import { ChartOfAccountModel } from "@/infrastructure/database/models/ChartOfAccount";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { logAction } from "@/lib/logger";

const expenseSchema = z.object({
  companyId: z.string(),
  vendor: z.string().min(2),
  category: z.string().min(2),
  amount: z.number().positive(),
  date: z.string(),
});

export async function createExpense(formData: FormData) {
  try {
    await connectToDatabase();

    // In real app, extract from session
    const companyId = formData.get("companyId") as string;
    const adminId = "60d5ecb8b392d22b28f745d1";

    const parsed = expenseSchema.parse({
      companyId,
      vendor: formData.get("vendor"),
      category: formData.get("category"),
      amount: parseFloat(formData.get("amount") as string),
      date: formData.get("date"),
    });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Save expense record (Auto approved here for MVP)
      const expense = new ExpenseModel({
        companyId: new mongoose.Types.ObjectId(parsed.companyId),
        vendor: parsed.vendor,
        category: parsed.category,
        amount: mongoose.Types.Decimal128.fromString(parsed.amount.toString()),
        approvalStatus: "APPROVED",
        date: new Date(parsed.date),
        createdBy: new mongoose.Types.ObjectId(adminId),
      });

      await expense.save({ session });

      // 2. Automated Action: generate auto journal mapping
      // Find accounts (in real life mapped to settings, here we query by code)
      const bankAccount = await ChartOfAccountModel.findOne({ companyId: parsed.companyId, code: "1100" }).session(session);
      const expenseAccount = await ChartOfAccountModel.findOne({ companyId: parsed.companyId, code: "5100" }).session(session); // Using Office Exp 5100

      if (!bankAccount || !expenseAccount) throw new Error("Missing default mapped accounts 1100 or 5100");

      const journal = await AccountingEngine.recordTransaction({
        companyId: parsed.companyId,
        date: new Date(parsed.date),
        description: `Expense ${parsed.category} - Vendor: ${parsed.vendor}`,
        source: "EXPENSE",
        lines: [
          { accountId: expenseAccount._id.toString(), debit: parsed.amount, credit: 0 },
          { accountId: bankAccount._id.toString(), debit: 0, credit: parsed.amount },
        ],
        createdBy: adminId
      }, session);

      expense.journalId = journal._id as mongoose.Types.ObjectId;
      await expense.save({ session });

      // 3. Audit Logging
      await logAction({
        companyId: parsed.companyId,
        userId: adminId,
        action: "CREATE",
        module: "EXPENSE",
        resourceId: expense._id.toString(),
        newValue: parsed
      }, session);

      await session.commitTransaction();
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }

    revalidatePath("/dashboard/expense");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
