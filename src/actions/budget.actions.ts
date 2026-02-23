"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/page-session";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { BudgetModel, IBudgetLine } from "@/infrastructure/database/models/Budget";
import { JournalEntryModel } from "@/infrastructure/database/models/JournalEntry";
import { ChartOfAccountModel } from "@/infrastructure/database/models/ChartOfAccount";
import mongoose from "mongoose";
import Decimal from "decimal.js";

const BudgetLineSchema = z.object({
  accountId: z.string(),
  amount: z.number(),
  notes: z.string().optional(),
});

const CreateBudgetSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  fiscalYear: z.number().min(2000).max(2100),
  periodType: z.enum(["ANNUAL", "QUARTERLY", "MONTHLY"]),
  periodNumber: z.number().optional(),
  departmentId: z.string().optional(),
  costCenterId: z.string().optional(),
  projectId: z.string().optional(),
  lines: z.array(BudgetLineSchema),
});

const UpdateBudgetSchema = CreateBudgetSchema.partial();

export async function createBudget(formData: FormData) {
  const session = await requireAuth();
  await requirePermission(session, "BUDGET", "CREATE");
  await connectToDatabase();

  const linesRaw = formData.get("lines");
  const input = CreateBudgetSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    fiscalYear: parseInt(formData.get("fiscalYear") as string),
    periodType: formData.get("periodType"),
    periodNumber: formData.get("periodNumber") ? parseInt(formData.get("periodNumber") as string) : undefined,
    departmentId: formData.get("departmentId") || undefined,
    costCenterId: formData.get("costCenterId") || undefined,
    projectId: formData.get("projectId") || undefined,
    lines: linesRaw ? JSON.parse(linesRaw as string) : [],
  });

  // Validate period number based on period type
  if (input.periodType === "QUARTERLY" && (!input.periodNumber || input.periodNumber < 1 || input.periodNumber > 4)) {
    throw new Error("Quarterly budget requires a period number between 1 and 4");
  }
  if (input.periodType === "MONTHLY" && (!input.periodNumber || input.periodNumber < 1 || input.periodNumber > 12)) {
    throw new Error("Monthly budget requires a period number between 1 and 12");
  }

  // Fetch account details for lines
  const accountIds = input.lines.map(l => new mongoose.Types.ObjectId(l.accountId));
  const accounts = await ChartOfAccountModel.find({ _id: { $in: accountIds } });
  const accountMap = new Map(accounts.map(a => [a._id.toString(), a]));

  // Calculate total and enrich lines
  let totalAmount = new Decimal(0);
  const enrichedLines = input.lines.map(line => {
    const account = accountMap.get(line.accountId);
    totalAmount = totalAmount.plus(line.amount);
    return {
      accountId: new mongoose.Types.ObjectId(line.accountId),
      accountCode: account?.code,
      accountName: account?.name,
      amount: line.amount,
      notes: line.notes,
    };
  });

  const budget = await BudgetModel.create({
    companyId: new mongoose.Types.ObjectId(session.companyId),
    name: input.name,
    description: input.description,
    fiscalYear: input.fiscalYear,
    periodType: input.periodType,
    periodNumber: input.periodNumber,
    departmentId: input.departmentId ? new mongoose.Types.ObjectId(input.departmentId) : undefined,
    costCenterId: input.costCenterId ? new mongoose.Types.ObjectId(input.costCenterId) : undefined,
    projectId: input.projectId ? new mongoose.Types.ObjectId(input.projectId) : undefined,
    lines: enrichedLines,
    totalAmount: totalAmount.toNumber(),
    status: "DRAFT",
    createdBy: new mongoose.Types.ObjectId(session.user.id),
  });

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "CREATE",
    module: "Budget",
    resourceId: budget._id.toString(),
    newValue: { name: input.name, fiscalYear: input.fiscalYear, totalAmount: totalAmount.toNumber() },
  });

  revalidatePath("/budget");
  return { success: true, id: budget._id.toString() };
}

export async function getBudgets(filters?: { fiscalYear?: number; status?: string; departmentId?: string }) {
  const session = await requireAuth();
  await requirePermission(session, "BUDGET", "READ");
  await connectToDatabase();

  const query: Record<string, unknown> = {
    companyId: new mongoose.Types.ObjectId(session.companyId),
  };

  if (filters?.fiscalYear) query.fiscalYear = filters.fiscalYear;
  if (filters?.status) query.status = filters.status;
  if (filters?.departmentId) query.departmentId = new mongoose.Types.ObjectId(filters.departmentId);

  const budgets = await BudgetModel.find(query)
    .populate("departmentId", "name")
    .populate("costCenterId", "code name")
    .populate("projectId", "code name")
    .sort({ fiscalYear: -1, periodNumber: 1 });

  return budgets.map(b => ({
    id: b._id.toString(),
    name: b.name,
    description: b.description,
    fiscalYear: b.fiscalYear,
    periodType: b.periodType,
    periodNumber: b.periodNumber,
    departmentName: (b.departmentId as unknown as { name: string })?.name,
    costCenterCode: (b.costCenterId as unknown as { code: string })?.code,
    projectCode: (b.projectId as unknown as { code: string })?.code,
    totalAmount: b.totalAmount ? parseFloat(b.totalAmount.toString()) : 0,
    status: b.status,
    lineCount: b.lines.length,
    createdAt: b.createdAt,
  }));
}

export async function getBudgetDetails(budgetId: string) {
  const session = await requireAuth();
  await requirePermission(session, "BUDGET", "READ");
  await connectToDatabase();

  const budget = await BudgetModel.findOne({
    _id: new mongoose.Types.ObjectId(budgetId),
    companyId: new mongoose.Types.ObjectId(session.companyId),
  })
    .populate("departmentId", "name")
    .populate("costCenterId", "code name")
    .populate("projectId", "code name")
    .populate("approvedBy", "name");

  if (!budget) throw new Error("Budget not found");

  return {
    id: budget._id.toString(),
    name: budget.name,
    description: budget.description,
    fiscalYear: budget.fiscalYear,
    periodType: budget.periodType,
    periodNumber: budget.periodNumber,
    departmentName: (budget.departmentId as unknown as { name: string })?.name,
    costCenterCode: (budget.costCenterId as unknown as { code: string })?.code,
    costCenterName: (budget.costCenterId as unknown as { name: string })?.name,
    projectCode: (budget.projectId as unknown as { code: string })?.code,
    projectName: (budget.projectId as unknown as { name: string })?.name,
    lines: budget.lines.map((l: IBudgetLine) => ({
      accountId: l.accountId.toString(),
      accountCode: l.accountCode,
      accountName: l.accountName,
      amount: parseFloat(l.amount.toString()),
      notes: l.notes,
    })),
    totalAmount: budget.totalAmount ? parseFloat(budget.totalAmount.toString()) : 0,
    status: budget.status,
    approvedBy: (budget.approvedBy as unknown as { name: string })?.name,
    approvedAt: budget.approvedAt,
    createdAt: budget.createdAt,
  };
}

export async function updateBudget(budgetId: string, formData: FormData) {
  const session = await requireAuth();
  await requirePermission(session, "BUDGET", "UPDATE");
  await connectToDatabase();

  const budget = await BudgetModel.findOne({
    _id: new mongoose.Types.ObjectId(budgetId),
    companyId: new mongoose.Types.ObjectId(session.companyId),
  });

  if (!budget) throw new Error("Budget not found");
  if (budget.status !== "DRAFT" && budget.status !== "REJECTED") {
    throw new Error("Only DRAFT or REJECTED budgets can be edited");
  }

  const linesRaw = formData.get("lines");
  const input = UpdateBudgetSchema.parse({
    name: formData.get("name") || undefined,
    description: formData.get("description") || undefined,
    lines: linesRaw ? JSON.parse(linesRaw as string) : undefined,
  });

  const updateData: Record<string, unknown> = {};
  if (input.name) updateData.name = input.name;
  if (input.description) updateData.description = input.description;

  if (input.lines) {
    const accountIds = input.lines.map(l => new mongoose.Types.ObjectId(l.accountId));
    const accounts = await ChartOfAccountModel.find({ _id: { $in: accountIds } });
    const accountMap = new Map(accounts.map(a => [a._id.toString(), a]));

    let totalAmount = new Decimal(0);
    const enrichedLines = input.lines.map(line => {
      const account = accountMap.get(line.accountId);
      totalAmount = totalAmount.plus(line.amount);
      return {
        accountId: new mongoose.Types.ObjectId(line.accountId),
        accountCode: account?.code,
        accountName: account?.name,
        amount: line.amount,
        notes: line.notes,
      };
    });

    updateData.lines = enrichedLines;
    updateData.totalAmount = totalAmount.toNumber();
  }

  await BudgetModel.findByIdAndUpdate(budgetId, { $set: updateData });

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "UPDATE",
    module: "Budget",
    resourceId: budgetId,
    newValue: input,
  });

  revalidatePath("/budget");
  return { success: true };
}

export async function submitBudget(budgetId: string) {
  const session = await requireAuth();
  await requirePermission(session, "BUDGET", "UPDATE");
  await connectToDatabase();

  const budget = await BudgetModel.findOne({
    _id: new mongoose.Types.ObjectId(budgetId),
    companyId: new mongoose.Types.ObjectId(session.companyId),
    status: { $in: ["DRAFT", "REJECTED"] },
  });

  if (!budget) throw new Error("Budget not found or not in DRAFT/REJECTED status");

  budget.status = "SUBMITTED";
  await budget.save();

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "SUBMIT",
    module: "Budget",
    resourceId: budgetId,
  });

  revalidatePath("/budget");
  return { success: true };
}

export async function approveBudget(budgetId: string) {
  const session = await requireAuth();
  await requirePermission(session, "BUDGET", "APPROVE");
  await connectToDatabase();

  const budget = await BudgetModel.findOne({
    _id: new mongoose.Types.ObjectId(budgetId),
    companyId: new mongoose.Types.ObjectId(session.companyId),
    status: "SUBMITTED",
  });

  if (!budget) throw new Error("Budget not found or not in SUBMITTED status");

  budget.status = "APPROVED";
  budget.approvedBy = new mongoose.Types.ObjectId(session.user.id);
  budget.approvedAt = new Date();
  await budget.save();

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "APPROVE",
    module: "Budget",
    resourceId: budgetId,
  });

  revalidatePath("/budget");
  return { success: true };
}

export async function rejectBudget(budgetId: string, reason: string) {
  const session = await requireAuth();
  await requirePermission(session, "BUDGET", "APPROVE");
  await connectToDatabase();

  const budget = await BudgetModel.findOne({
    _id: new mongoose.Types.ObjectId(budgetId),
    companyId: new mongoose.Types.ObjectId(session.companyId),
    status: "SUBMITTED",
  });

  if (!budget) throw new Error("Budget not found or not in SUBMITTED status");

  budget.status = "REJECTED";
  await budget.save();

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "REJECT",
    module: "Budget",
    resourceId: budgetId,
    newValue: { reason },
  });

  revalidatePath("/budget");
  return { success: true };
}

export async function activateBudget(budgetId: string) {
  const session = await requireAuth();
  await requirePermission(session, "BUDGET", "UPDATE");
  await connectToDatabase();

  const budget = await BudgetModel.findOne({
    _id: new mongoose.Types.ObjectId(budgetId),
    companyId: new mongoose.Types.ObjectId(session.companyId),
    status: "APPROVED",
  });

  if (!budget) throw new Error("Budget not found or not in APPROVED status");

  budget.status = "ACTIVE";
  await budget.save();

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "ACTIVATE",
    module: "Budget",
    resourceId: budgetId,
  });

  revalidatePath("/budget");
  return { success: true };
}

// Budget vs Actual comparison
export async function getBudgetVsActual(budgetId: string) {
  const session = await requireAuth();
  await requirePermission(session, "BUDGET", "READ");
  await connectToDatabase();

  const budget = await BudgetModel.findOne({
    _id: new mongoose.Types.ObjectId(budgetId),
    companyId: new mongoose.Types.ObjectId(session.companyId),
  });

  if (!budget) throw new Error("Budget not found");

  // Determine date range based on budget period
  let startDate: Date;
  let endDate: Date;

  if (budget.periodType === "ANNUAL") {
    startDate = new Date(budget.fiscalYear, 0, 1);
    endDate = new Date(budget.fiscalYear, 11, 31);
  } else if (budget.periodType === "QUARTERLY") {
    const quarter = budget.periodNumber || 1;
    const startMonth = (quarter - 1) * 3;
    startDate = new Date(budget.fiscalYear, startMonth, 1);
    endDate = new Date(budget.fiscalYear, startMonth + 3, 0);
  } else {
    // Monthly
    const month = (budget.periodNumber || 1) - 1;
    startDate = new Date(budget.fiscalYear, month, 1);
    endDate = new Date(budget.fiscalYear, month + 1, 0);
  }

  // Get actual amounts from journal entries for each budgeted account
  const budgetLines = budget.lines as IBudgetLine[];
  const accountIds = budgetLines.map(l => l.accountId);
  
  const actuals = await JournalEntryModel.aggregate([
    {
      $match: {
        companyId: new mongoose.Types.ObjectId(session.companyId),
        date: { $gte: startDate, $lte: endDate },
        status: "POSTED",
      },
    },
    { $unwind: "$lines" },
    {
      $match: {
        "lines.accountId": { $in: accountIds },
      },
    },
    {
      $group: {
        _id: "$lines.accountId",
        totalDebit: { $sum: { $toDouble: "$lines.debit" } },
        totalCredit: { $sum: { $toDouble: "$lines.credit" } },
      },
    },
  ]);

  const actualMap = new Map(actuals.map(a => [a._id.toString(), a]));

  // Build comparison
  const comparison = budgetLines.map(line => {
    const actual = actualMap.get(line.accountId.toString());
    const budgetAmount = parseFloat(line.amount.toString());
    
    // For expense accounts, actual is debit. For revenue, actual is credit.
    // Simplified: use net (debit - credit) magnitude
    const actualAmount = actual 
      ? Math.abs(actual.totalDebit - actual.totalCredit) 
      : 0;
    
    const variance = budgetAmount - actualAmount;
    const variancePercent = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0;

    return {
      accountCode: line.accountCode,
      accountName: line.accountName,
      budgetAmount,
      actualAmount,
      variance,
      variancePercent,
      status: variance >= 0 ? "UNDER_BUDGET" : "OVER_BUDGET",
    };
  });

  const totalBudget = budget.totalAmount ? parseFloat(budget.totalAmount.toString()) : 0;
  let totalActual = 0;
  for (const c of comparison) {
    totalActual += c.actualAmount;
  }

  return {
    budgetName: budget.name,
    fiscalYear: budget.fiscalYear,
    periodType: budget.periodType,
    periodNumber: budget.periodNumber,
    dateRange: { startDate, endDate },
    lines: comparison,
    summary: {
      totalBudget,
      totalActual,
      totalVariance: totalBudget - totalActual,
      variancePercent: totalBudget > 0 ? ((totalBudget - totalActual) / totalBudget) * 100 : 0,
    },
  };
}

export async function deleteBudget(budgetId: string) {
  const session = await requireAuth();
  await requirePermission(session, "BUDGET", "DELETE");
  await connectToDatabase();

  const budget = await BudgetModel.findOne({
    _id: new mongoose.Types.ObjectId(budgetId),
    companyId: new mongoose.Types.ObjectId(session.companyId),
    status: { $in: ["DRAFT", "REJECTED"] },
  });

  if (!budget) throw new Error("Budget not found or cannot be deleted (only DRAFT/REJECTED)");

  await budget.deleteOne();

  await logAction({
    companyId: session.companyId,
    userId: session.user.id,
    action: "DELETE",
    module: "Budget",
    resourceId: budgetId,
  });

  revalidatePath("/budget");
  return { success: true };
}
