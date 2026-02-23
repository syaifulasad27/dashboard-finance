"use server";

import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { chartOfAccountRepository } from "@/infrastructure/repositories/coa.repository";
import { requireAuth, AuthorizationError } from "@/lib/session";

export async function getChartOfAccounts() {
  try {
    const session = await requireAuth();
    
    await connectToDatabase();
    
    const accounts = await chartOfAccountRepository.findAllActive(session.companyId);
    
    // Transform for client use
    return {
      success: true,
      accounts: accounts.map((acc: any) => ({
        id: acc._id.toString(),
        code: acc.code,
        name: acc.name,
        type: acc.type,
      })),
    };
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return { success: false, error: "Please log in to continue", accounts: [] };
    }
    return { success: false, error: error.message, accounts: [] };
  }
}
