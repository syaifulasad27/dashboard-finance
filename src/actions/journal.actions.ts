"use server";

import { revalidatePath } from "next/cache";
import { AccountingEngine } from "@/core/engines/accounting.engine";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

const journalSchema = z.object({
  companyId: z.string(),
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
    await connectToDatabase();

    // In real app, extract companyId & createdBy from auth session context
    const companyId = formData.get("companyId") as string;
    const description = formData.get("description") as string;
    const date = new Date(formData.get("date") as string);
    const rawLines = JSON.parse(formData.get("lines") as string);

    const parsed = journalSchema.parse({ companyId, description, date: date.toISOString(), lines: rawLines });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await AccountingEngine.recordTransaction({
        companyId: parsed.companyId,
        date,
        description: parsed.description,
        source: "MANUAL",
        lines: parsed.lines,
        createdBy: "60d5ecb8b392d22b28f745d1" // Mock user ID 
      }, session);

      await session.commitTransaction();
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }

    revalidatePath("/dashboard/journal");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
