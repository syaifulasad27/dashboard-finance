import { NextRequest } from "next/server";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { 
  validateApiRequest, 
  checkApiPermission, 
  apiError, 
  apiSuccess 
} from "@/lib/api-middleware";
import { ExpenseModel } from "@/infrastructure/database/models/Expense";
import { logAction } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to format Decimal128
function formatDecimal(value: unknown): number {
  if (!value) return 0;
  return parseFloat(value.toString());
}

// GET /api/v1/expenses/[id] - Get single expense
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await validateApiRequest();
  if (!authResult.success) return authResult.response;
  
  const { companyId } = authResult.context;
  const permError = checkApiPermission(authResult.context, "EXPENSE", "READ");
  if (permError) return permError;

  try {
    await connectToDatabase();
    const { id } = await params;

    const expense = await ExpenseModel.findOne({ _id: id, companyId })
      .populate("createdBy", "name email")
      .populate("journalId", "journalNo status")
      .lean();

    if (!expense) {
      return apiError("Expense not found", 404);
    }

    return apiSuccess({
      id: expense._id.toString(),
      date: expense.date,
      vendor: expense.vendor,
      category: expense.category,
      amount: formatDecimal(expense.amount),
      tax: formatDecimal(expense.tax),
      total: formatDecimal(expense.amount) + formatDecimal(expense.tax),
      attachment: expense.attachment,
      approvalStatus: expense.approvalStatus,
      journal: expense.journalId,
      createdBy: expense.createdBy,
      createdAt: expense.createdAt,
    });
  } catch (error) {
    console.error("API GET expense error:", error);
    return apiError("Failed to fetch expense");
  }
}

// PUT /api/v1/expenses/[id] - Update expense (only if PENDING)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const authResult = await validateApiRequest();
  if (!authResult.success) return authResult.response;
  
  const { userId, companyId } = authResult.context;
  const permError = checkApiPermission(authResult.context, "EXPENSE", "UPDATE");
  if (permError) return permError;

  try {
    await connectToDatabase();
    const { id } = await params;
    const body = await request.json();

    const expense = await ExpenseModel.findOne({ _id: id, companyId });
    if (!expense) {
      return apiError("Expense not found", 404);
    }

    if (expense.approvalStatus !== "PENDING") {
      return apiError("Cannot update expense that is not PENDING", 400);
    }

    // Build update object
    const update: Record<string, unknown> = {};
    
    if (body.date) update.date = new Date(body.date);
    if (body.vendor) update.vendor = body.vendor;
    if (body.category) update.category = body.category;
    if (body.amount !== undefined) update.amount = body.amount;
    if (body.tax !== undefined) update.tax = body.tax;
    if (body.attachment !== undefined) update.attachment = body.attachment;

    await ExpenseModel.updateOne({ _id: id, companyId }, { $set: update });

    await logAction({
      action: "UPDATE",
      module: "EXPENSE",
      resourceId: id,
      userId,
      companyId,
      oldValue: { vendor: expense.vendor, amount: formatDecimal(expense.amount) },
      newValue: update,
    });

    return apiSuccess({ id });
  } catch (error) {
    console.error("API PUT expense error:", error);
    return apiError("Failed to update expense");
  }
}

// DELETE /api/v1/expenses/[id] - Delete expense (only if PENDING)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await validateApiRequest();
  if (!authResult.success) return authResult.response;
  
  const { userId, companyId } = authResult.context;
  const permError = checkApiPermission(authResult.context, "EXPENSE", "DELETE");
  if (permError) return permError;

  try {
    await connectToDatabase();
    const { id } = await params;

    const expense = await ExpenseModel.findOne({ _id: id, companyId });
    if (!expense) {
      return apiError("Expense not found", 404);
    }

    if (expense.approvalStatus !== "PENDING") {
      return apiError("Cannot delete expense that is not PENDING", 400);
    }

    await ExpenseModel.deleteOne({ _id: id, companyId });

    await logAction({
      action: "DELETE",
      module: "EXPENSE",
      resourceId: id,
      userId,
      companyId,
      oldValue: { vendor: expense.vendor, amount: formatDecimal(expense.amount) },
    });

    return apiSuccess({ id, message: "Expense deleted" });
  } catch (error) {
    console.error("API DELETE expense error:", error);
    return apiError("Failed to delete expense");
  }
}
