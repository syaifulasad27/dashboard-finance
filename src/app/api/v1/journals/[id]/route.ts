import { NextRequest } from "next/server";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { 
  validateApiRequest, 
  checkApiPermission, 
  apiError, 
  apiSuccess 
} from "@/lib/api-middleware";
import { JournalEntryModel } from "@/infrastructure/database/models/JournalEntry";
import { logAction } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to format Decimal128
function formatDecimal(value: unknown): number {
  if (!value) return 0;
  return parseFloat(value.toString());
}

// GET /api/v1/journals/[id] - Get single journal entry
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await validateApiRequest();
  if (!authResult.success) return authResult.response;
  
  const { companyId } = authResult.context;
  const permError = checkApiPermission(authResult.context, "JOURNAL", "READ");
  if (permError) return permError;

  try {
    await connectToDatabase();
    const { id } = await params;

    const journal = await JournalEntryModel.findOne({ _id: id, companyId })
      .populate("lines.accountId", "code name type")
      .populate("createdBy", "name email")
      .lean();

    if (!journal) {
      return apiError("Journal entry not found", 404);
    }

    let totalDebit = 0;
    let totalCredit = 0;
    
    const lines = journal.lines.map((line: { accountId: unknown; debit: unknown; credit: unknown; description?: string }) => {
      const debit = formatDecimal(line.debit);
      const credit = formatDecimal(line.credit);
      totalDebit += debit;
      totalCredit += credit;
      
      return {
        account: line.accountId,
        debit,
        credit,
        description: line.description,
      };
    });

    return apiSuccess({
      id: journal._id.toString(),
      journalNo: journal.journalNo,
      date: journal.date,
      description: journal.description,
      source: journal.source,
      status: journal.status,
      lines,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      createdBy: journal.createdBy,
      createdAt: journal.createdAt,
    });
  } catch (error) {
    console.error("API GET journal error:", error);
    return apiError("Failed to fetch journal");
  }
}

// POST /api/v1/journals/[id]/post - Post a draft journal
export async function POST(request: NextRequest, { params }: RouteParams) {
  const authResult = await validateApiRequest();
  if (!authResult.success) return authResult.response;
  
  const { userId, companyId } = authResult.context;
  const permError = checkApiPermission(authResult.context, "JOURNAL", "APPROVE");
  if (permError) return permError;

  try {
    await connectToDatabase();
    const { id } = await params;

    const journal = await JournalEntryModel.findOne({ _id: id, companyId });
    if (!journal) {
      return apiError("Journal entry not found", 404);
    }

    if (journal.status !== "DRAFT") {
      return apiError(`Cannot post journal with status ${journal.status}`, 400);
    }

    await JournalEntryModel.updateOne(
      { _id: id, companyId },
      { $set: { status: "POSTED" } }
    );

    await logAction({
      action: "POST",
      module: "JOURNAL",
      resourceId: id,
      userId,
      companyId,
      oldValue: { status: "DRAFT" },
      newValue: { status: "POSTED" },
    });

    return apiSuccess({ id, status: "POSTED" });
  } catch (error) {
    console.error("API POST journal error:", error);
    return apiError("Failed to post journal");
  }
}

// DELETE /api/v1/journals/[id] - Void a journal entry
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await validateApiRequest();
  if (!authResult.success) return authResult.response;
  
  const { userId, companyId } = authResult.context;
  const permError = checkApiPermission(authResult.context, "JOURNAL", "DELETE");
  if (permError) return permError;

  try {
    await connectToDatabase();
    const { id } = await params;

    const journal = await JournalEntryModel.findOne({ _id: id, companyId });
    if (!journal) {
      return apiError("Journal entry not found", 404);
    }

    if (journal.status === "VOID") {
      return apiError("Journal is already voided", 400);
    }

    // Void instead of delete (journals should not be hard deleted)
    await JournalEntryModel.updateOne(
      { _id: id, companyId },
      { $set: { status: "VOID" } }
    );

    await logAction({
      action: "VOID",
      module: "JOURNAL",
      resourceId: id,
      userId,
      companyId,
      oldValue: { status: journal.status },
      newValue: { status: "VOID" },
    });

    return apiSuccess({ id, message: "Journal voided", status: "VOID" });
  } catch (error) {
    console.error("API DELETE journal error:", error);
    return apiError("Failed to void journal");
  }
}
