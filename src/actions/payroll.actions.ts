"use server";

import { revalidatePath } from "next/cache";
import { PayrollEngine } from "@/core/engines/payroll.engine";
import { logAction } from "@/lib/logger";
import { requireAuth, AuthorizationError, ForbiddenError } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";

export async function processPayrollBatch(month: number, year: number) {
  try {
    // 1. Authenticate and get session context
    const session = await requireAuth();
    
    // 2. Check permission - HR_ADMIN or SUPER_ADMIN can process payroll
    requirePermission(session, "PAYROLL", "CREATE");

    const result = await PayrollEngine.processMonthlyPayroll(
      session.companyId,
      month,
      year,
      session.userId
    );

    await logAction({
      companyId: session.companyId,
      userId: session.userId,
      action: "PROCESS",
      module: "PAYROLL",
      resourceId: result.batchId?.toString(),
      newValue: { month, year }
    });

    revalidatePath("/payroll");
    revalidatePath("/journal");

    return { success: true, batchId: result.batchId?.toString() };
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
