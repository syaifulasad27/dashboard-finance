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
import { ExpenseModel } from "@/infrastructure/database/models/Expense";
import { logAction } from "@/lib/logger";

// Helper to format Decimal128
function formatDecimal(value: unknown): number {
  if (!value) return 0;
  return parseFloat(value.toString());
}

// GET /api/v1/expenses - List expenses
export async function GET(request: NextRequest) {
  const authResult = await validateApiRequest();
  if (!authResult.success) return authResult.response;
  
  const { companyId } = authResult.context;
  const permError = checkApiPermission(authResult.context, "EXPENSE", "READ");
  if (permError) return permError;

  try {
    await connectToDatabase();
    
    const { page, limit, skip } = parsePagination(request);
    const { startDate, endDate } = parseDateRange(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    
    const query: Record<string, unknown> = { companyId };
    if (status) query.approvalStatus = status;
    if (category) query.category = category;
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    const [expenses, total] = await Promise.all([
      ExpenseModel.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ date: -1 })
        .populate("createdBy", "name email")
        .populate("journalId", "journalNo")
        .lean(),
      ExpenseModel.countDocuments(query),
    ]);

    const formatted = expenses.map(e => ({
      id: e._id.toString(),
      date: e.date,
      vendor: e.vendor,
      category: e.category,
      amount: formatDecimal(e.amount),
      tax: formatDecimal(e.tax),
      total: formatDecimal(e.amount) + formatDecimal(e.tax),
      attachment: e.attachment,
      approvalStatus: e.approvalStatus,
      journalId: e.journalId ? (e.journalId as unknown as { _id: unknown })._id?.toString() : null,
      journalNo: e.journalId ? (e.journalId as unknown as { journalNo: string }).journalNo : null,
      createdBy: e.createdBy,
      createdAt: e.createdAt,
    }));

    return apiSuccess({
      expenses: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("API GET expenses error:", error);
    return apiError("Failed to fetch expenses");
  }
}

// POST /api/v1/expenses - Create expense
export async function POST(request: NextRequest) {
  const authResult = await validateApiRequest();
  if (!authResult.success) return authResult.response;
  
  const { userId, companyId } = authResult.context;
  const permError = checkApiPermission(authResult.context, "EXPENSE", "CREATE");
  if (permError) return permError;

  try {
    await connectToDatabase();
    
    const body = await request.json();
    
    // Validate required fields
    const required = ["date", "vendor", "category", "amount"];
    for (const field of required) {
      if (!body[field]) {
        return apiError(`Missing required field: ${field}`, 400);
      }
    }

    const expense = await ExpenseModel.create({
      companyId,
      date: new Date(body.date),
      vendor: body.vendor,
      category: body.category,
      amount: body.amount,
      tax: body.tax || 0,
      attachment: body.attachment,
      approvalStatus: "PENDING",
      createdBy: userId,
    });

    await logAction({
      action: "CREATE",
      module: "EXPENSE",
      resourceId: expense._id.toString(),
      userId,
      companyId,
      newValue: { vendor: body.vendor, amount: body.amount },
    });

    return apiSuccess({ id: expense._id.toString() }, 201);
  } catch (error) {
    console.error("API POST expense error:", error);
    return apiError("Failed to create expense");
  }
}

