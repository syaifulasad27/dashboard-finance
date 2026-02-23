/**
 * CSV Export/Import Service
 * Provides functionality to export data to CSV format and import from CSV
 */

// CSV utility functions
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  
  const str = String(value);
  // If contains comma, newline, or double quotes, wrap in quotes and escape internal quotes
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

export function parseCsv(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== "");
  return lines.map(line => parseCsvLine(line));
}

export function generateCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCsvValue).join(",");
  const dataLines = rows.map(row => row.map(escapeCsvValue).join(","));
  return [headerLine, ...dataLines].join("\n");
}

// Employee CSV export
export interface EmployeeExportRow {
  nik: string;
  name: string;
  email: string;
  npwp: string;
  bpjsNumber: string;
  employmentStatus: string;
  joinDate: string;
  basicSalary: string;
  ptkpStatus: string;
  departmentName: string;
  costCenterCode: string;
  isActive: string;
}

export const EMPLOYEE_CSV_HEADERS = [
  "nik",
  "name", 
  "email",
  "npwp",
  "bpjsNumber",
  "employmentStatus",
  "joinDate",
  "basicSalary",
  "ptkpStatus",
  "departmentName",
  "costCenterCode",
  "isActive",
];

export function employeesToCsv(employees: EmployeeExportRow[]): string {
  const rows = employees.map(e => [
    e.nik,
    e.name,
    e.email,
    e.npwp,
    e.bpjsNumber,
    e.employmentStatus,
    e.joinDate,
    e.basicSalary,
    e.ptkpStatus,
    e.departmentName,
    e.costCenterCode,
    e.isActive,
  ]);
  return generateCsv(EMPLOYEE_CSV_HEADERS, rows);
}

// Expense CSV export
export interface ExpenseExportRow {
  date: string;
  vendor: string;
  category: string;
  amount: string;
  tax: string;
  approvalStatus: string;
  createdBy: string;
}

export const EXPENSE_CSV_HEADERS = [
  "date",
  "vendor",
  "category",
  "amount",
  "tax",
  "approvalStatus",
  "createdBy",
];

export function expensesToCsv(expenses: ExpenseExportRow[]): string {
  const rows = expenses.map(e => [
    e.date,
    e.vendor,
    e.category,
    e.amount,
    e.tax,
    e.approvalStatus,
    e.createdBy,
  ]);
  return generateCsv(EXPENSE_CSV_HEADERS, rows);
}

// Revenue CSV export
export interface RevenueExportRow {
  date: string;
  invoiceNumber: string;
  customer: string;
  source: string;
  amount: string;
  tax: string;
  paymentMethod: string;
  status: string;
}

export const REVENUE_CSV_HEADERS = [
  "date",
  "invoiceNumber",
  "customer",
  "source",
  "amount",
  "tax",
  "paymentMethod",
  "status",
];

export function revenuesToCsv(revenues: RevenueExportRow[]): string {
  const rows = revenues.map(r => [
    r.date,
    r.invoiceNumber,
    r.customer,
    r.source,
    r.amount,
    r.tax,
    r.paymentMethod,
    r.status,
  ]);
  return generateCsv(REVENUE_CSV_HEADERS, rows);
}

// Journal Entry CSV export
export interface JournalExportRow {
  journalNo: string;
  date: string;
  description: string;
  source: string;
  status: string;
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
  lineDescription: string;
}

export const JOURNAL_CSV_HEADERS = [
  "journalNo",
  "date",
  "description",
  "source",
  "status",
  "accountCode",
  "accountName",
  "debit",
  "credit",
  "lineDescription",
];

export function journalsToCsv(journals: JournalExportRow[]): string {
  const rows = journals.map(j => [
    j.journalNo,
    j.date,
    j.description,
    j.source,
    j.status,
    j.accountCode,
    j.accountName,
    j.debit,
    j.credit,
    j.lineDescription,
  ]);
  return generateCsv(JOURNAL_CSV_HEADERS, rows);
}

// Chart of Accounts CSV export
export interface CoaExportRow {
  code: string;
  name: string;
  type: string;
  parentCode: string;
  isActive: string;
}

export const COA_CSV_HEADERS = [
  "code",
  "name",
  "type",
  "parentCode",
  "isActive",
];

export function coaToCsv(accounts: CoaExportRow[]): string {
  const rows = accounts.map(a => [
    a.code,
    a.name,
    a.type,
    a.parentCode,
    a.isActive,
  ]);
  return generateCsv(COA_CSV_HEADERS, rows);
}

// Import validation types
export interface ImportResult<T> {
  success: boolean;
  data: T[];
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  totalRows: number;
  validRows: number;
}

// Validate imported employee data
export function validateEmployeeImport(rows: string[][]): ImportResult<Partial<EmployeeExportRow>> {
  const result: ImportResult<Partial<EmployeeExportRow>> = {
    success: true,
    data: [],
    errors: [],
    totalRows: rows.length - 1, // Exclude header
    validRows: 0,
  };

  // Skip header row  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    
    if (row.length < EMPLOYEE_CSV_HEADERS.length) {
      result.errors.push({ row: rowNum, field: "row", message: "Insufficient columns" });
      continue;
    }

    const employee: Partial<EmployeeExportRow> = {
      nik: row[0],
      name: row[1],
      email: row[2],
      npwp: row[3],
      bpjsNumber: row[4],
      employmentStatus: row[5],
      joinDate: row[6],
      basicSalary: row[7],
      ptkpStatus: row[8],
      departmentName: row[9],
      costCenterCode: row[10],
      isActive: row[11],
    };

    // Validate required fields
    if (!employee.nik) {
      result.errors.push({ row: rowNum, field: "nik", message: "NIK is required" });
    }
    if (!employee.name) {
      result.errors.push({ row: rowNum, field: "name", message: "Name is required" });
    }
    if (!employee.email) {
      result.errors.push({ row: rowNum, field: "email", message: "Email is required" });
    }
    if (!employee.employmentStatus || !["PERMANENT", "CONTRACT", "PROBATION"].includes(employee.employmentStatus)) {
      result.errors.push({ row: rowNum, field: "employmentStatus", message: "Invalid employment status" });
    }
    if (!employee.basicSalary || isNaN(parseFloat(employee.basicSalary))) {
      result.errors.push({ row: rowNum, field: "basicSalary", message: "Invalid basic salary" });
    }

    // If no errors for this row, add to data
    const rowErrors = result.errors.filter(e => e.row === rowNum);
    if (rowErrors.length === 0) {
      result.data.push(employee);
      result.validRows++;
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

// Validate imported expense data
export function validateExpenseImport(rows: string[][]): ImportResult<Partial<ExpenseExportRow>> {
  const result: ImportResult<Partial<ExpenseExportRow>> = {
    success: true,
    data: [],
    errors: [],
    totalRows: rows.length - 1,
    validRows: 0,
  };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    
    if (row.length < EXPENSE_CSV_HEADERS.length) {
      result.errors.push({ row: rowNum, field: "row", message: "Insufficient columns" });
      continue;
    }

    const expense: Partial<ExpenseExportRow> = {
      date: row[0],
      vendor: row[1],
      category: row[2],
      amount: row[3],
      tax: row[4],
    };

    // Validate required fields
    if (!expense.date || isNaN(Date.parse(expense.date))) {
      result.errors.push({ row: rowNum, field: "date", message: "Invalid date format" });
    }
    if (!expense.vendor) {
      result.errors.push({ row: rowNum, field: "vendor", message: "Vendor is required" });
    }
    if (!expense.category) {
      result.errors.push({ row: rowNum, field: "category", message: "Category is required" });
    }
    if (!expense.amount || isNaN(parseFloat(expense.amount))) {
      result.errors.push({ row: rowNum, field: "amount", message: "Invalid amount" });
    }

    const rowErrors = result.errors.filter(e => e.row === rowNum);
    if (rowErrors.length === 0) {
      result.data.push(expense);
      result.validRows++;
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

// Validate imported Chart of Accounts data
export function validateCoaImport(rows: string[][]): ImportResult<Partial<CoaExportRow>> {
  const result: ImportResult<Partial<CoaExportRow>> = {
    success: true,
    data: [],
    errors: [],
    totalRows: rows.length - 1,
    validRows: 0,
  };

  const validTypes = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    
    if (row.length < COA_CSV_HEADERS.length) {
      result.errors.push({ row: rowNum, field: "row", message: "Insufficient columns" });
      continue;
    }

    const account: Partial<CoaExportRow> = {
      code: row[0],
      name: row[1],
      type: row[2],
      parentCode: row[3],
      isActive: row[4],
    };

    // Validate required fields
    if (!account.code) {
      result.errors.push({ row: rowNum, field: "code", message: "Code is required" });
    }
    if (!account.name) {
      result.errors.push({ row: rowNum, field: "name", message: "Name is required" });
    }
    if (!account.type || !validTypes.includes(account.type.toUpperCase())) {
      result.errors.push({ row: rowNum, field: "type", message: "Invalid account type" });
    }

    const rowErrors = result.errors.filter(e => e.row === rowNum);
    if (rowErrors.length === 0) {
      result.data.push(account);
      result.validRows++;
    }
  }

  result.success = result.errors.length === 0;
  return result;
}
