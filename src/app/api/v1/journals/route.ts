import { NextRequest } from "next/server";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { 
  validateApiRequest, 
  checkApiPermission, 
  apiError, 
  apiSuccess, 
  parsePagination,
  parseDateRange 
} from "@/lib/api-middleware";
import { JournalEntryModel } from "@/infrastructure/database/models/JournalEntry";
import { ChartOfAccountModel } from "@/infrastructure/database/models/ChartOfAccount";
import { logAction } from "@/lib/logger";

// Helper to format Decimal128
function formatDecimal(value: unknown): number {
  if (!value) return 0;
  return parseFloat(value.toString());
}

// GET /api/v1/journals - List journal entries
export async function GET(request: NextRequest) {
  const authResult = await validateApiRequest();
  if (!authResult.success) return authResult.response;
  
  const { companyId } = authResult.context;
  const permError = checkApiPermission(authResult.context, "JOURNAL", "READ");
  if (permError) return permError;

  try {
    await connectToDatabase();
    
    const { page, limit, skip } = parsePagination(request);
    const { startDate, endDate } = parseDateRange(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    
    const query: Record<string, unknown> = { companyId };
    if (status) query.status = status;
    if (source) query.source = source;
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    const [journals, total] = await Promise.all([
      JournalEntryModel.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ date: -1, journalNo: -1 })
        .populate("lines.accountId", "code name type")
        .populate("createdBy", "name")
        .lean(),
      JournalEntryModel.countDocuments(query),
    ]);

    const formatted = journals.map(j => {
      let totalDebit = 0;
      let totalCredit = 0;
      
      const lines = j.lines.map((line: { accountId: unknown; debit: unknown; credit: unknown; description?: string }) => {
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

      return {
        id: j._id.toString(),
        journalNo: j.journalNo,
        date: j.date,
        description: j.description,
        source: j.source,
        status: j.status,
        lines,
        totalDebit,
        totalCredit,
        isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
        createdBy: j.createdBy,
        createdAt: j.createdAt,
      };
    });

    return apiSuccess({
      journals: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("API GET journals error:", error);
    return apiError("Failed to fetch journals");
  }
}

// POST /api/v1/journals - Create journal entry
export async function POST(request: NextRequest) {
  const authResult = await validateApiRequest();
  if (!authResult.success) return authResult.response;
  
  const { userId, companyId } = authResult.context;
  const permError = checkApiPermission(authResult.context, "JOURNAL", "CREATE");
  if (permError) return permError;

  try {
    await connectToDatabase();
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.date) return apiError("Missing required field: date", 400);
    if (!body.description) return apiError("Missing required field: description", 400);
    if (!body.lines || !Array.isArray(body.lines) || body.lines.length < 2) {
      return apiError("Journal must have at least 2 lines", 400);
    }

    // Validate lines balance
    let totalDebit = 0;
    let totalCredit = 0;
    
    for (const line of body.lines) {
      if (!line.accountId) return apiError("Each line must have accountId", 400);
      if (line.debit === undefined && line.credit === undefined) {
        return apiError("Each line must have debit or credit", 400);
      }
      
      totalDebit += Number(line.debit || 0);
      totalCredit += Number(line.credit || 0);
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return apiError(`Journal is unbalanced. Debit: ${totalDebit}, Credit: ${totalCredit}`, 400);
    }

    // Validate account IDs exist
    const accountIds = body.lines.map((l: { accountId: string }) => l.accountId);
    const accounts = await ChartOfAccountModel.find({
      _id: { $in: accountIds },
      companyId,
    });
    
    if (accounts.length !== accountIds.length) {
      return apiError("One or more account IDs are invalid", 400);
    }

    // Generate journal number
    const lastJournal = await JournalEntryModel.findOne({ companyId })
      .sort({ journalNo: -1 })
      .select("journalNo");
    
    const lastNum = lastJournal?.journalNo 
      ? parseInt(lastJournal.journalNo.split("-").pop() || "0", 10) 
      : 0;
    const journalNo = `JV-${String(lastNum + 1).padStart(6, "0")}`;

    const journal = await JournalEntryModel.create({
      companyId,
      journalNo,
      date: new Date(body.date),
      description: body.description,
      source: body.source || "MANUAL",
      status: "DRAFT",
      lines: body.lines.map((line: { accountId: string; debit?: number; credit?: number; description?: string }) => ({
        accountId: line.accountId,
        debit: line.debit || 0,
        credit: line.credit || 0,
        description: line.description,
      })),
      createdBy: userId,
    });

    await logAction({
      action: "CREATE",
      module: "JOURNAL",
      resourceId: journal._id.toString(),
      userId,
      companyId,
      newValue: { journalNo, description: body.description, totalDebit },
    });

    return apiSuccess({ id: journal._id.toString(), journalNo }, 201);
  } catch (error) {
    console.error("API POST journal error:", error);
    return apiError("Failed to create journal");
  }
}

