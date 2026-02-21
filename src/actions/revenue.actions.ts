"use server";

import { revalidatePath } from "next/cache";
import { AccountingEngine } from "@/core/engines/accounting.engine";
import { RevenueModel } from "@/infrastructure/database/models/Revenue";
import { ChartOfAccountModel } from "@/infrastructure/database/models/ChartOfAccount";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { logAction } from "@/lib/logger";

const revenueSchema = z.object({
  companyId: z.string(),
  source: z.string().min(2),
  customer: z.string().min(2),
  invoiceNumber: z.string().min(2),
  amount: z.number().positive(),
  paymentMethod: z.enum(["BANK_TRANSFER", "CASH", "CREDIT_CARD"]),
  date: z.string(),
});

export async function createRevenue(formData: FormData) {
  try {
    await connectToDatabase();

    // In real app, extract from session
    const companyId = formData.get("companyId") as string;
    const adminId = "60d5ecb8b392d22b28f745d1";

    const parsed = revenueSchema.parse({
      companyId,
      source: formData.get("source"),
      customer: formData.get("customer"),
      invoiceNumber: formData.get("invoiceNumber"),
      amount: parseFloat(formData.get("amount") as string),
      paymentMethod: formData.get("paymentMethod"),
      date: formData.get("date"),
    });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Save revenue record
      const revenue = new RevenueModel({
        companyId: new mongoose.Types.ObjectId(parsed.companyId),
        source: parsed.source,
        customer: parsed.customer,
        invoiceNumber: parsed.invoiceNumber,
        amount: mongoose.Types.Decimal128.fromString(parsed.amount.toString()),
        paymentMethod: parsed.paymentMethod,
        date: new Date(parsed.date),
        createdBy: new mongoose.Types.ObjectId(adminId),
      });

      await revenue.save({ session });

      // 2. Automated Action: generate auto journal mapping
      // Find accounts (in real life mapped to settings, here we query by code)
      const bankAccount = await ChartOfAccountModel.findOne({ companyId: parsed.companyId, code: "1100" }).session(session);
      const revAccount = await ChartOfAccountModel.findOne({ companyId: parsed.companyId, code: "4000" }).session(session);

      if (!bankAccount || !revAccount) throw new Error("Missing default mapped accounts 1100 or 4000");

      const journal = await AccountingEngine.recordTransaction({
        companyId: parsed.companyId,
        date: new Date(parsed.date),
        description: `Revenue via ${parsed.source} - Inv: ${parsed.invoiceNumber}`,
        source: "REVENUE",
        lines: [
          { accountId: bankAccount._id.toString(), debit: parsed.amount, credit: 0 },
          { accountId: revAccount._id.toString(), debit: 0, credit: parsed.amount },
        ],
        createdBy: adminId
      }, session);

      revenue.journalId = journal._id as mongoose.Types.ObjectId;
      await revenue.save({ session });

      // 3. Audit Logging
      await logAction({
        companyId: parsed.companyId,
        userId: adminId,
        action: "CREATE",
        module: "REVENUE",
        resourceId: revenue._id.toString(),
        newValue: parsed
      }, session);

      await session.commitTransaction();
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }

    revalidatePath("/dashboard/revenue");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
