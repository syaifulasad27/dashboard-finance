"use server";

import { revalidatePath } from "next/cache";
import { PayrollEngine } from "@/core/engines/payroll.engine";
import { logAction } from "@/lib/logger";

export async function processPayrollBatch(companyId: string, month: number, year: number) {
  try {
    const adminId = "60d5ecb8b392d22b28f745d1"; // Mocked admin ID
    const result = await PayrollEngine.processMonthlyPayroll(companyId, month, year, adminId);

    await logAction({
      companyId,
      userId: adminId,
      action: "PROCESS",
      module: "PAYROLL",
      resourceId: result.batchId?.toString(),
      newValue: { month, year }
    });

    revalidatePath("/dashboard/payroll");
    revalidatePath("/dashboard/journal");

    return { success: true, batchId: result.batchId?.toString() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
