"use server";

import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { requireAuth } from "@/lib/page-session";
import { requirePermission } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import {
  parseCsv,
  employeesToCsv,
  expensesToCsv,
  revenuesToCsv,
  journalsToCsv,
  coaToCsv,
  validateEmployeeImport,
  validateExpenseImport,
  validateCoaImport,
  type EmployeeExportRow,
  type ExpenseExportRow,
  type RevenueExportRow,
  type JournalExportRow,
  type CoaExportRow,
} from "@/core/services/csv.service";
import { EmployeeModel } from "@/infrastructure/database/models/Employee";
import { ExpenseModel } from "@/infrastructure/database/models/Expense";
import { RevenueModel } from "@/infrastructure/database/models/Revenue";
import { JournalEntryModel } from "@/infrastructure/database/models/JournalEntry";
import { ChartOfAccountModel } from "@/infrastructure/database/models/ChartOfAccount";
import { DepartmentModel } from "@/infrastructure/database/models/Department";
import { CostCenterModel } from "@/infrastructure/database/models/CostCenter";
import mongoose from "mongoose";

// Helper to format Decimal128 to string
function formatDecimal(value: mongoose.Types.Decimal128 | undefined | null): string {
  if (!value) return "0";
  return value.toString();
}

// Helper to format date to ISO string
function formatDate(date: Date | undefined | null): string {
  if (!date) return "";
  return date.toISOString().split("T")[0];
}

// ==================== EXPORT ACTIONS ====================

/**
 * Export employees to CSV format
 */
export async function exportEmployeesToCsv(): Promise<{
  success: boolean;
  data?: string;
  error?: string;
}> {
  const session = await requireAuth();
  requirePermission(session, "EMPLOYEE", "READ");

  try {
    await connectToDatabase();

    // Get department and cost center lookup maps
    const departments = await DepartmentModel.find({ companyId: session.companyId }).lean();
    const costCenters = await CostCenterModel.find({ companyId: session.companyId }).lean();
    
    const deptMap = new Map(departments.map(d => [d._id.toString(), d.name]));
    const ccMap = new Map(costCenters.map(c => [c._id.toString(), c.code]));

    const employees = await EmployeeModel.find({ companyId: session.companyId })
      .sort({ nik: 1 })
      .lean();

    const exportRows: EmployeeExportRow[] = employees.map(e => ({
      nik: e.nik,
      name: e.name,
      email: e.email,
      npwp: e.npwp || "",
      bpjsNumber: e.bpjsNumber || "",
      employmentStatus: e.employmentStatus,
      joinDate: formatDate(e.joinDate),
      basicSalary: formatDecimal(e.salaryConfig?.basicSalary),
      ptkpStatus: e.salaryConfig?.ptkpStatus || "TK/0",
      departmentName: e.departmentId ? deptMap.get(e.departmentId.toString()) || "" : "",
      costCenterCode: e.costCenterId ? ccMap.get(e.costCenterId.toString()) || "" : "",
      isActive: String(e.isActive),
    }));

    const csv = employeesToCsv(exportRows);

    await logAction({
      action: "EXPORT_CSV",
      module: "EMPLOYEE",
      resourceId: "all",
      userId: session.userId,
      companyId: session.companyId,
      newValue: { count: exportRows.length },
    });

    return { success: true, data: csv };
  } catch (error) {
    console.error("Export employees error:", error);
    return { success: false, error: "Failed to export employees" };
  }
}

/**
 * Export expenses to CSV format
 */
export async function exportExpensesToCsv(filters?: {
  startDate?: string;
  endDate?: string;
  status?: string;
}): Promise<{
  success: boolean;
  data?: string;
  error?: string;
}> {
  const session = await requireAuth();
  requirePermission(session, "EXPENSE", "READ");

  try {
    await connectToDatabase();

    const query: Record<string, unknown> = { companyId: session.companyId };
    if (filters?.startDate && filters?.endDate) {
      query.date = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }
    if (filters?.status) {
      query.approvalStatus = filters.status;
    }

    const expenses = await ExpenseModel.find(query)
      .populate("createdBy", "name")
      .sort({ date: -1 })
      .lean();

    const exportRows: ExpenseExportRow[] = expenses.map(e => ({
      date: formatDate(e.date),
      vendor: e.vendor,
      category: e.category,
      amount: formatDecimal(e.amount),
      tax: formatDecimal(e.tax),
      approvalStatus: e.approvalStatus,
      createdBy: (e.createdBy as unknown as { name: string })?.name || "",
    }));

    const csv = expensesToCsv(exportRows);

    await logAction({
      action: "EXPORT_CSV",
      module: "EXPENSE",
      resourceId: "filtered",
      userId: session.userId,
      companyId: session.companyId,
      newValue: { count: exportRows.length, filters },
    });

    return { success: true, data: csv };
  } catch (error) {
    console.error("Export expenses error:", error);
    return { success: false, error: "Failed to export expenses" };
  }
}

/**
 * Export revenues to CSV format
 */
export async function exportRevenuesToCsv(filters?: {
  startDate?: string;
  endDate?: string;
  status?: string;
}): Promise<{
  success: boolean;
  data?: string;
  error?: string;
}> {
  const session = await requireAuth();
  requirePermission(session, "REVENUE", "READ");

  try {
    await connectToDatabase();

    const query: Record<string, unknown> = { companyId: session.companyId };
    if (filters?.startDate && filters?.endDate) {
      query.date = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }
    if (filters?.status) {
      query.status = filters.status;
    }

    const revenues = await RevenueModel.find(query)
      .sort({ date: -1 })
      .lean();

    const exportRows: RevenueExportRow[] = revenues.map(r => ({
      date: formatDate(r.date),
      invoiceNumber: r.invoiceNumber,
      customer: r.customer,
      source: r.source,
      amount: formatDecimal(r.amount),
      tax: formatDecimal(r.tax),
      paymentMethod: r.paymentMethod,
      status: r.status,
    }));

    const csv = revenuesToCsv(exportRows);

    await logAction({
      action: "EXPORT_CSV",
      module: "REVENUE",
      resourceId: "filtered",
      userId: session.userId,
      companyId: session.companyId,
      newValue: { count: exportRows.length, filters },
    });

    return { success: true, data: csv };
  } catch (error) {
    console.error("Export revenues error:", error);
    return { success: false, error: "Failed to export revenues" };
  }
}

/**
 * Export journal entries to CSV format (flattened with lines)
 */
export async function exportJournalsToCsv(filters?: {
  startDate?: string;
  endDate?: string;
  status?: string;
}): Promise<{
  success: boolean;
  data?: string;
  error?: string;
}> {
  const session = await requireAuth();
  requirePermission(session, "JOURNAL", "READ");

  try {
    await connectToDatabase();

    const query: Record<string, unknown> = { companyId: session.companyId };
    if (filters?.startDate && filters?.endDate) {
      query.date = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }
    if (filters?.status) {
      query.status = filters.status;
    }

    const journals = await JournalEntryModel.find(query)
      .populate("lines.accountId", "code name")
      .sort({ date: -1, journalNo: 1 })
      .lean();

    // Flatten journal entries with their lines
    const exportRows: JournalExportRow[] = [];
    for (const j of journals) {
      for (const line of j.lines) {
        const account = line.accountId as unknown as { code: string; name: string } | null;
        exportRows.push({
          journalNo: j.journalNo,
          date: formatDate(j.date),
          description: j.description,
          source: j.source,
          status: j.status,
          accountCode: account?.code || "",
          accountName: account?.name || "",
          debit: formatDecimal(line.debit),
          credit: formatDecimal(line.credit),
          lineDescription: line.description || "",
        });
      }
    }

    const csv = journalsToCsv(exportRows);

    await logAction({
      action: "EXPORT_CSV",
      module: "JOURNAL",
      resourceId: "filtered",
      userId: session.userId,
      companyId: session.companyId,
      newValue: { count: journals.length, lineCount: exportRows.length, filters },
    });

    return { success: true, data: csv };
  } catch (error) {
    console.error("Export journals error:", error);
    return { success: false, error: "Failed to export journals" };
  }
}

/**
 * Export chart of accounts to CSV format
 */
export async function exportCoaToCsv(): Promise<{
  success: boolean;
  data?: string;
  error?: string;
}> {
  const session = await requireAuth();
  requirePermission(session, "COA", "READ");

  try {
    await connectToDatabase();

    const accounts = await ChartOfAccountModel.find({ companyId: session.companyId })
      .populate("parentId", "code")
      .sort({ code: 1 })
      .lean();

    const exportRows: CoaExportRow[] = accounts.map(a => ({
      code: a.code,
      name: a.name,
      type: a.type,
      parentCode: (a.parentId as unknown as { code: string } | null)?.code || "",
      isActive: String(a.isActive),
    }));

    const csv = coaToCsv(exportRows);

    await logAction({
      action: "EXPORT_CSV",
      module: "COA",
      resourceId: "all",
      userId: session.userId,
      companyId: session.companyId,
      newValue: { count: exportRows.length },
    });

    return { success: true, data: csv };
  } catch (error) {
    console.error("Export COA error:", error);
    return { success: false, error: "Failed to export chart of accounts" };
  }
}

// ==================== IMPORT ACTIONS ====================

/**
 * Import employees from CSV content
 */
export async function importEmployeesFromCsv(csvContent: string): Promise<{
  success: boolean;
  imported?: number;
  errors?: Array<{ row: number; field: string; message: string }>;
  error?: string;
}> {
  const session = await requireAuth();
  requirePermission(session, "EMPLOYEE", "CREATE");

  try {
    await connectToDatabase();

    const rows = parseCsv(csvContent);
    const validation = validateEmployeeImport(rows);

    if (!validation.success) {
      return {
        success: false,
        imported: 0,
        errors: validation.errors,
      };
    }

    // Get department and cost center maps for lookup
    const departments = await DepartmentModel.find({ companyId: session.companyId }).lean();
    const costCenters = await CostCenterModel.find({ companyId: session.companyId }).lean();
    
    const deptMap = new Map(departments.map(d => [d.name.toLowerCase(), d._id]));
    const ccMap = new Map(costCenters.map(c => [c.code.toLowerCase(), c._id]));

    let imported = 0;
    const importErrors: Array<{ row: number; field: string; message: string }> = [];

    for (let i = 0; i < validation.data.length; i++) {
      const row = validation.data[i];
      const rowNum = i + 2; // Account for header and 0-index

      try {
        // Check if employee with NIK already exists
        const existing = await EmployeeModel.findOne({
          companyId: session.companyId,
          nik: row.nik,
        });

        if (existing) {
          importErrors.push({ row: rowNum, field: "nik", message: "Employee with this NIK already exists" });
          continue;
        }

        // Lookup department and cost center
        let departmentId;
        let costCenterId;

        if (row.departmentName) {
          departmentId = deptMap.get(row.departmentName.toLowerCase());
          if (!departmentId) {
            importErrors.push({ row: rowNum, field: "departmentName", message: "Department not found" });
            continue;
          }
        }

        if (row.costCenterCode) {
          costCenterId = ccMap.get(row.costCenterCode.toLowerCase());
          if (!costCenterId) {
            importErrors.push({ row: rowNum, field: "costCenterCode", message: "Cost center not found" });
            continue;
          }
        }

        await EmployeeModel.create({
          companyId: session.companyId,
          nik: row.nik,
          name: row.name,
          email: row.email,
          npwp: row.npwp || undefined,
          bpjsNumber: row.bpjsNumber || undefined,
          employmentStatus: row.employmentStatus,
          joinDate: new Date(row.joinDate!),
          departmentId,
          costCenterId,
          salaryConfig: {
            basicSalary: parseFloat(row.basicSalary!),
            allowances: [],
            deductions: [],
            bpjsKesehatan: true,
            bpjsKetenagakerjaan: true,
            ptkpStatus: row.ptkpStatus || "TK/0",
          },
          isActive: row.isActive?.toLowerCase() !== "false",
        });

        imported++;
      } catch (err) {
        console.error(`Error importing row ${rowNum}:`, err);
        importErrors.push({ row: rowNum, field: "row", message: "Failed to import row" });
      }
    }

    await logAction({
      action: "IMPORT_CSV",
      module: "EMPLOYEE",
      resourceId: "bulk",
      userId: session.userId,
      companyId: session.companyId,
      newValue: { imported, errors: importErrors.length },
    });

    return {
      success: importErrors.length === 0,
      imported,
      errors: importErrors.length > 0 ? importErrors : undefined,
    };
  } catch (error) {
    console.error("Import employees error:", error);
    return { success: false, error: "Failed to import employees" };
  }
}

/**
 * Import expenses from CSV content
 */
export async function importExpensesFromCsv(csvContent: string): Promise<{
  success: boolean;
  imported?: number;
  errors?: Array<{ row: number; field: string; message: string }>;
  error?: string;
}> {
  const session = await requireAuth();
  requirePermission(session, "EXPENSE", "CREATE");

  try {
    await connectToDatabase();

    const rows = parseCsv(csvContent);
    const validation = validateExpenseImport(rows);

    if (!validation.success) {
      return {
        success: false,
        imported: 0,
        errors: validation.errors,
      };
    }

    let imported = 0;
    const importErrors: Array<{ row: number; field: string; message: string }> = [];

    for (let i = 0; i < validation.data.length; i++) {
      const row = validation.data[i];
      const rowNum = i + 2;

      try {
        await ExpenseModel.create({
          companyId: session.companyId,
          date: new Date(row.date!),
          vendor: row.vendor,
          category: row.category,
          amount: parseFloat(row.amount!),
          tax: row.tax ? parseFloat(row.tax) : 0,
          approvalStatus: "PENDING",
          createdBy: session.userId,
        });

        imported++;
      } catch (err) {
        console.error(`Error importing expense row ${rowNum}:`, err);
        importErrors.push({ row: rowNum, field: "row", message: "Failed to import row" });
      }
    }

    await logAction({
      action: "IMPORT_CSV",
      module: "EXPENSE",
      resourceId: "bulk",
      userId: session.userId,
      companyId: session.companyId,
      newValue: { imported, errors: importErrors.length },
    });

    return {
      success: importErrors.length === 0,
      imported,
      errors: importErrors.length > 0 ? importErrors : undefined,
    };
  } catch (error) {
    console.error("Import expenses error:", error);
    return { success: false, error: "Failed to import expenses" };
  }
}

/**
 * Import chart of accounts from CSV content
 */
export async function importCoaFromCsv(csvContent: string): Promise<{
  success: boolean;
  imported?: number;
  errors?: Array<{ row: number; field: string; message: string }>;
  error?: string;
}> {
  const session = await requireAuth();
  requirePermission(session, "COA", "CREATE");

  try {
    await connectToDatabase();

    const rows = parseCsv(csvContent);
    const validation = validateCoaImport(rows);

    if (!validation.success) {
      return {
        success: false,
        imported: 0,
        errors: validation.errors,
      };
    }

    // First pass: create accounts without parents
    const codeToIdMap = new Map<string, mongoose.Types.ObjectId>();
    let imported = 0;
    const importErrors: Array<{ row: number; field: string; message: string }> = [];

    // Sort by code to ensure parent accounts are created first
    const sortedData = [...validation.data].sort((a, b) => 
      (a.code || "").localeCompare(b.code || "")
    );

    for (let i = 0; i < sortedData.length; i++) {
      const row = sortedData[i];
      const rowNum = i + 2;

      try {
        // Check if account with code already exists
        const existing = await ChartOfAccountModel.findOne({
          companyId: session.companyId,
          code: row.code,
        });

        if (existing) {
          codeToIdMap.set(row.code!, existing._id as mongoose.Types.ObjectId);
          importErrors.push({ row: rowNum, field: "code", message: "Account code already exists, skipped" });
          continue;
        }

        // Find parent if specified
        let parentId;
        if (row.parentCode) {
          parentId = codeToIdMap.get(row.parentCode);
          if (!parentId) {
            const parent = await ChartOfAccountModel.findOne({
              companyId: session.companyId,
              code: row.parentCode,
            });
            if (parent) {
              parentId = parent._id as mongoose.Types.ObjectId;
            }
          }
        }

        const newAccount = await ChartOfAccountModel.create({
          companyId: session.companyId,
          code: row.code,
          name: row.name,
          type: row.type!.toUpperCase(),
          parentId,
          isActive: row.isActive?.toLowerCase() !== "false",
        });

        codeToIdMap.set(row.code!, newAccount._id as mongoose.Types.ObjectId);
        imported++;
      } catch (err) {
        console.error(`Error importing COA row ${rowNum}:`, err);
        importErrors.push({ row: rowNum, field: "row", message: "Failed to import row" });
      }
    }

    await logAction({
      action: "IMPORT_CSV",
      module: "COA",
      resourceId: "bulk",
      userId: session.userId,
      companyId: session.companyId,
      newValue: { imported, errors: importErrors.length },
    });

    return {
      success: importErrors.length === 0,
      imported,
      errors: importErrors.length > 0 ? importErrors : undefined,
    };
  } catch (error) {
    console.error("Import COA error:", error);
    return { success: false, error: "Failed to import chart of accounts" };
  }
}
