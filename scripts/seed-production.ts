/**
 * Production-Safe Demo Seed Script
 * 
 * Creates complete demo data for Financial Dashboard:
 * - 1 Company
 * - 5 Users (all roles with login credentials)
 * - Full Chart of Accounts (enterprise-ready hierarchical)
 * - Departments & Cost Centers
 * - 10+ Employees with various PTKP statuses
 * - 3 months of Revenue & Expense transactions
 * - Processed Payroll with slips
 * - Auto-balanced Journals
 * 
 * IDEMPOTENT: Safe to re-run (deletes existing company data first)
 * 
 * Usage: npx tsx scripts/seed-production.ts
 */

// Load environment variables FIRST (before any imports that use them)
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Decimal from "decimal.js";
import { connectToDatabase } from "../src/infrastructure/database/mongodb";

// Import all models
import { CompanyModel } from "../src/infrastructure/database/models/Company";
import { ChartOfAccountModel } from "../src/infrastructure/database/models/ChartOfAccount";
import { DepartmentModel } from "../src/infrastructure/database/models/Department";
import { CostCenterModel } from "../src/infrastructure/database/models/CostCenter";
import { EmployeeModel } from "../src/infrastructure/database/models/Employee";
import { RevenueModel } from "../src/infrastructure/database/models/Revenue";
import { ExpenseModel } from "../src/infrastructure/database/models/Expense";
import { PayrollModel } from "../src/infrastructure/database/models/Payroll";
import { PayrollSlipModel } from "../src/infrastructure/database/models/PayrollSlip";
import { JournalEntryModel } from "../src/infrastructure/database/models/JournalEntry";
import { BudgetModel } from "../src/infrastructure/database/models/Budget";

// ============================================
// CONFIGURATION
// ============================================
const COMPANY_DATA = {
  name: "PT Maju Bersama Sejahtera",
  npwp: "01.234.567.8-901.000",
  address: "Jl. Sudirman No. 123, Jakarta Selatan, DKI Jakarta 12190",
  timezone: "Asia/Jakarta",
  currency: "IDR",
  industry: "Technology & Consulting",
  isActive: true,
};

// Default password for all demo users (hash will be generated)
const DEFAULT_PASSWORD = "Demo@2024!";

const USERS_DATA = [
  { name: "Budi Santoso", email: "admin@demo.com", role: "SUPER_ADMIN" },
  { name: "Siti Rahayu", email: "finance@demo.com", role: "FINANCE_ADMIN" },
  { name: "Ahmad Wijaya", email: "hr@demo.com", role: "HR_ADMIN" },
  { name: "Dewi Lestari", email: "auditor@demo.com", role: "AUDITOR" },
  { name: "Rini Susanti", email: "viewer@demo.com", role: "VIEWER" },
] as const;

// Enterprise-ready Chart of Accounts (hierarchical)
const CHART_OF_ACCOUNTS = [
  // ASSETS (1xxx)
  { code: "1000", name: "Aset", type: "ASSET", parent: null },
  { code: "1100", name: "Aset Lancar", type: "ASSET", parent: "1000" },
  { code: "1110", name: "Kas dan Setara Kas", type: "ASSET", parent: "1100" },
  { code: "1111", name: "Kas Kecil", type: "ASSET", parent: "1110" },
  { code: "1112", name: "Bank BCA - IDR", type: "ASSET", parent: "1110" },
  { code: "1113", name: "Bank Mandiri - IDR", type: "ASSET", parent: "1110" },
  { code: "1120", name: "Piutang Usaha", type: "ASSET", parent: "1100" },
  { code: "1121", name: "Piutang Dagang", type: "ASSET", parent: "1120" },
  { code: "1122", name: "Cadangan Kerugian Piutang", type: "ASSET", parent: "1120" },
  { code: "1130", name: "Persediaan", type: "ASSET", parent: "1100" },
  { code: "1140", name: "Biaya Dibayar Di Muka", type: "ASSET", parent: "1100" },
  { code: "1141", name: "Sewa Dibayar Di Muka", type: "ASSET", parent: "1140" },
  { code: "1142", name: "Asuransi Dibayar Di Muka", type: "ASSET", parent: "1140" },
  { code: "1200", name: "Aset Tetap", type: "ASSET", parent: "1000" },
  { code: "1210", name: "Tanah", type: "ASSET", parent: "1200" },
  { code: "1220", name: "Bangunan", type: "ASSET", parent: "1200" },
  { code: "1221", name: "Akumulasi Penyusutan Bangunan", type: "ASSET", parent: "1220" },
  { code: "1230", name: "Kendaraan", type: "ASSET", parent: "1200" },
  { code: "1231", name: "Akumulasi Penyusutan Kendaraan", type: "ASSET", parent: "1230" },
  { code: "1240", name: "Peralatan Kantor", type: "ASSET", parent: "1200" },
  { code: "1241", name: "Akumulasi Penyusutan Peralatan", type: "ASSET", parent: "1240" },
  { code: "1250", name: "Komputer & IT Equipment", type: "ASSET", parent: "1200" },
  { code: "1251", name: "Akumulasi Penyusutan Komputer", type: "ASSET", parent: "1250" },

  // LIABILITIES (2xxx)
  { code: "2000", name: "Kewajiban", type: "LIABILITY", parent: null },
  { code: "2100", name: "Kewajiban Lancar", type: "LIABILITY", parent: "2000" },
  { code: "2110", name: "Utang Usaha", type: "LIABILITY", parent: "2100" },
  { code: "2111", name: "Utang Dagang", type: "LIABILITY", parent: "2110" },
  { code: "2120", name: "Utang Pajak", type: "LIABILITY", parent: "2100" },
  { code: "2121", name: "Utang PPh 21", type: "LIABILITY", parent: "2120" },
  { code: "2122", name: "Utang PPh 23", type: "LIABILITY", parent: "2120" },
  { code: "2123", name: "Utang PPN", type: "LIABILITY", parent: "2120" },
  { code: "2130", name: "Utang Gaji", type: "LIABILITY", parent: "2100" },
  { code: "2140", name: "Utang BPJS", type: "LIABILITY", parent: "2100" },
  { code: "2141", name: "Utang BPJS Kesehatan", type: "LIABILITY", parent: "2140" },
  { code: "2142", name: "Utang BPJS Ketenagakerjaan", type: "LIABILITY", parent: "2140" },
  { code: "2150", name: "Pendapatan Diterima Di Muka", type: "LIABILITY", parent: "2100" },
  { code: "2200", name: "Kewajiban Jangka Panjang", type: "LIABILITY", parent: "2000" },
  { code: "2210", name: "Utang Bank", type: "LIABILITY", parent: "2200" },

  // EQUITY (3xxx)
  { code: "3000", name: "Ekuitas", type: "EQUITY", parent: null },
  { code: "3100", name: "Modal Disetor", type: "EQUITY", parent: "3000" },
  { code: "3200", name: "Laba Ditahan", type: "EQUITY", parent: "3000" },
  { code: "3300", name: "Laba Tahun Berjalan", type: "EQUITY", parent: "3000" },

  // REVENUE (4xxx)
  { code: "4000", name: "Pendapatan", type: "REVENUE", parent: null },
  { code: "4100", name: "Pendapatan Usaha", type: "REVENUE", parent: "4000" },
  { code: "4110", name: "Pendapatan Jasa Konsultasi", type: "REVENUE", parent: "4100" },
  { code: "4120", name: "Pendapatan Jasa IT", type: "REVENUE", parent: "4100" },
  { code: "4130", name: "Pendapatan Jasa Training", type: "REVENUE", parent: "4100" },
  { code: "4140", name: "Pendapatan Penjualan Software", type: "REVENUE", parent: "4100" },
  { code: "4200", name: "Pendapatan Lain-lain", type: "REVENUE", parent: "4000" },
  { code: "4210", name: "Pendapatan Bunga Bank", type: "REVENUE", parent: "4200" },
  { code: "4220", name: "Pendapatan Sewa", type: "REVENUE", parent: "4200" },

  // EXPENSES (5xxx - 7xxx)
  { code: "5000", name: "Harga Pokok Penjualan", type: "EXPENSE", parent: null },
  { code: "5100", name: "Biaya Langsung Jasa", type: "EXPENSE", parent: "5000" },
  { code: "5110", name: "Biaya Tenaga Ahli", type: "EXPENSE", parent: "5100" },
  { code: "5120", name: "Biaya Subkontraktor", type: "EXPENSE", parent: "5100" },

  { code: "6000", name: "Beban Operasional", type: "EXPENSE", parent: null },
  { code: "6100", name: "Beban Gaji & Tunjangan", type: "EXPENSE", parent: "6000" },
  { code: "6110", name: "Beban Gaji Pokok", type: "EXPENSE", parent: "6100" },
  { code: "6120", name: "Beban Tunjangan", type: "EXPENSE", parent: "6100" },
  { code: "6130", name: "Beban BPJS - Perusahaan", type: "EXPENSE", parent: "6100" },
  { code: "6140", name: "Beban THR & Bonus", type: "EXPENSE", parent: "6100" },
  { code: "6200", name: "Beban Kantor", type: "EXPENSE", parent: "6000" },
  { code: "6210", name: "Beban Sewa Kantor", type: "EXPENSE", parent: "6200" },
  { code: "6220", name: "Beban Listrik & Air", type: "EXPENSE", parent: "6200" },
  { code: "6230", name: "Beban Telepon & Internet", type: "EXPENSE", parent: "6200" },
  { code: "6240", name: "Beban ATK & Perlengkapan", type: "EXPENSE", parent: "6200" },
  { code: "6300", name: "Beban Umum & Administrasi", type: "EXPENSE", parent: "6000" },
  { code: "6310", name: "Beban Perjalanan Dinas", type: "EXPENSE", parent: "6300" },
  { code: "6320", name: "Beban Representasi", type: "EXPENSE", parent: "6300" },
  { code: "6330", name: "Beban Profesional", type: "EXPENSE", parent: "6300" },
  { code: "6340", name: "Beban Asuransi", type: "EXPENSE", parent: "6300" },
  { code: "6400", name: "Beban Penyusutan", type: "EXPENSE", parent: "6000" },
  { code: "6410", name: "Beban Penyusutan Bangunan", type: "EXPENSE", parent: "6400" },
  { code: "6420", name: "Beban Penyusutan Kendaraan", type: "EXPENSE", parent: "6400" },
  { code: "6430", name: "Beban Penyusutan Peralatan", type: "EXPENSE", parent: "6400" },
  { code: "6440", name: "Beban Penyusutan Komputer", type: "EXPENSE", parent: "6400" },

  { code: "7000", name: "Beban Lain-lain", type: "EXPENSE", parent: null },
  { code: "7100", name: "Beban Bunga", type: "EXPENSE", parent: "7000" },
  { code: "7200", name: "Beban Bank", type: "EXPENSE", parent: "7000" },
  { code: "7300", name: "Kerugian Selisih Kurs", type: "EXPENSE", parent: "7000" },
];

const DEPARTMENTS = [
  { name: "Direksi", description: "Board of Directors" },
  { name: "Keuangan & Akuntansi", description: "Finance & Accounting Department" },
  { name: "Human Resources", description: "HR & People Operations" },
  { name: "Information Technology", description: "IT & Software Development" },
  { name: "Business Development", description: "Sales & Marketing" },
  { name: "Operations", description: "Project & Operations Management" },
];

const COST_CENTERS = [
  { code: "CC-001", name: "Head Office", description: "Kantor Pusat Jakarta" },
  { code: "CC-002", name: "Project Alpha", description: "Project Implementasi ERP" },
  { code: "CC-003", name: "Project Beta", description: "Project Aplikasi Mobile" },
  { code: "CC-004", name: "Support", description: "Technical Support & Maintenance" },
];

// Employees with various PTKP statuses and salary levels
const EMPLOYEES_DATA = [
  { nik: "EMP001", name: "Hendra Gunawan", email: "hendra@mbs.co.id", npwp: "12.345.678.9-012.000", ptkp: "K/3", basic: 25000000, status: "PERMANENT", dept: "Direksi" },
  { nik: "EMP002", name: "Linda Wijaya", email: "linda@mbs.co.id", npwp: "23.456.789.0-123.000", ptkp: "K/2", basic: 18000000, status: "PERMANENT", dept: "Keuangan & Akuntansi" },
  { nik: "EMP003", name: "Andi Pratama", email: "andi@mbs.co.id", npwp: "34.567.890.1-234.000", ptkp: "K/1", basic: 15000000, status: "PERMANENT", dept: "Information Technology" },
  { nik: "EMP004", name: "Maya Sari", email: "maya@mbs.co.id", npwp: "45.678.901.2-345.000", ptkp: "TK/0", basic: 12000000, status: "PERMANENT", dept: "Human Resources" },
  { nik: "EMP005", name: "Rizky Hidayat", email: "rizky@mbs.co.id", npwp: "56.789.012.3-456.000", ptkp: "K/0", basic: 14000000, status: "PERMANENT", dept: "Information Technology" },
  { nik: "EMP006", name: "Fitri Handayani", email: "fitri@mbs.co.id", npwp: "67.890.123.4-567.000", ptkp: "TK/0", basic: 10000000, status: "CONTRACT", dept: "Business Development" },
  { nik: "EMP007", name: "Dedi Kurniawan", email: "dedi@mbs.co.id", npwp: "78.901.234.5-678.000", ptkp: "K/1", basic: 11000000, status: "PERMANENT", dept: "Operations" },
  { nik: "EMP008", name: "Nurul Aini", email: "nurul@mbs.co.id", npwp: "89.012.345.6-789.000", ptkp: "TK/0", basic: 8500000, status: "PERMANENT", dept: "Keuangan & Akuntansi" },
  { nik: "EMP009", name: "Bagus Setiawan", email: "bagus@mbs.co.id", npwp: "90.123.456.7-890.000", ptkp: "K/2", basic: 13000000, status: "PERMANENT", dept: "Information Technology" },
  { nik: "EMP010", name: "Citra Dewi", email: "citra@mbs.co.id", npwp: "01.234.567.8-901.000", ptkp: "TK/0", basic: 7500000, status: "PROBATION", dept: "Human Resources" },
  { nik: "EMP011", name: "Eko Prasetyo", email: "eko@mbs.co.id", npwp: "11.222.333.4-555.000", ptkp: "K/0", basic: 9000000, status: "CONTRACT", dept: "Operations" },
  { nik: "EMP012", name: "Wulan Maharani", email: "wulan@mbs.co.id", npwp: "22.333.444.5-666.000", ptkp: "TK/0", basic: 8000000, status: "PERMANENT", dept: "Business Development" },
];

// ============================================
// HELPER FUNCTIONS
// ============================================
function toDecimal128(value: number): mongoose.Types.Decimal128 {
  return mongoose.Types.Decimal128.fromString(value.toString());
}

function getRandomDate(monthsAgo: number): Date {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, Math.floor(Math.random() * 28) + 1);
  return date;
}

function generateJournalNo(prefix: string, seq: number): string {
  return `${prefix}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(seq).padStart(4, "0")}`;
}

function generateInvoiceNo(seq: number): string {
  return `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(seq).padStart(4, "0")}`;
}

// ============================================
// MAIN SEED FUNCTION
// ============================================
async function seedProduction() {
  console.log("🚀 Starting production seed...\n");

  await connectToDatabase();

  // ============================================
  // STEP 1: Create Company
  // ============================================
  console.log("📦 Creating company...");

  // Check if company exists, delete old data if so
  const existingCompany = await CompanyModel.findOne({ npwp: COMPANY_DATA.npwp });
  let companyId: mongoose.Types.ObjectId;

  if (existingCompany) {
    console.log("   Found existing company, cleaning up data...");
    companyId = existingCompany._id as mongoose.Types.ObjectId;

    // Clean up all related data
    await Promise.all([
      JournalEntryModel.deleteMany({ companyId }),
      RevenueModel.deleteMany({ companyId }),
      ExpenseModel.deleteMany({ companyId }),
      PayrollSlipModel.deleteMany({ payrollId: { $in: (await PayrollModel.find({ companyId })).map(p => p._id) } }),
      PayrollModel.deleteMany({ companyId }),
      EmployeeModel.deleteMany({ companyId }),
      BudgetModel.deleteMany({ companyId }),
      ChartOfAccountModel.deleteMany({ companyId }),
      DepartmentModel.deleteMany({ companyId }),
      CostCenterModel.deleteMany({ companyId }),
    ]);

    // Update company data
    await CompanyModel.updateOne({ _id: companyId }, { $set: COMPANY_DATA });
    console.log(`   ✓ Company updated: ${COMPANY_DATA.name}`);
  } else {
    const company = await CompanyModel.create(COMPANY_DATA);
    companyId = company._id as mongoose.Types.ObjectId;
    console.log(`   ✓ Company created: ${COMPANY_DATA.name}`);
  }

  // ============================================
  // STEP 2: Create Users with Better Auth
  // ============================================
  console.log("\n👤 Creating users with Better Auth...");

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database not connected");

  // Better Auth uses 'user' collection (lowercase)
  const usersCollection = db.collection("user");
  const accountsCollection = db.collection("account");

  const userIds: mongoose.Types.ObjectId[] = [];

  for (const userData of USERS_DATA) {
    // Check if user exists
    const existingUser = await usersCollection.findOne({ email: userData.email });

    if (existingUser) {
      userIds.push(existingUser._id as mongoose.Types.ObjectId);
      // Update existing user's companyId and role
      await usersCollection.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            companyId: companyId.toString(),
            role: userData.role,
            name: userData.name,
          }
        }
      );

      // Ensure account exists for existing user (upsert password)
      const existingAccount = await accountsCollection.findOne({
        userId: existingUser._id, // Match by ObjectId
        providerId: "credential"
      });

      if (!existingAccount) {
        await accountsCollection.insertOne({
          _id: new mongoose.Types.ObjectId(),
          userId: existingUser._id, // Save as ObjectId
          providerId: "credential",
          accountId: existingUser._id.toString(), // accountId is often string, keep as is or try ObjectId. Better Auth docs usually show string for accountId if it's provider-specific, but for credentials it matches userId.
          password: passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`   ✓ User updated + account created: ${userData.email} (${userData.role})`);
      } else {
        // Update password for existing account
        await accountsCollection.updateOne(
          { _id: existingAccount._id },
          { $set: { password: passwordHash, updatedAt: new Date() } }
        );
        console.log(`   ✓ User updated: ${userData.email} (${userData.role})`);
      }
    } else {
      // Create new user (Better Auth format)
      const userId = new mongoose.Types.ObjectId();
      userIds.push(userId);

      await usersCollection.insertOne({
        _id: userId,
        name: userData.name,
        email: userData.email,
        emailVerified: true,
        companyId: companyId.toString(),
        role: userData.role,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create account (Better Auth credential format)
      await accountsCollection.insertOne({
        _id: new mongoose.Types.ObjectId(),
        userId: userId.toString(),
        providerId: "credential",
        accountId: userId.toString(),
        password: passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`   ✓ User created: ${userData.email} (${userData.role})`);
    }
  }

  const adminUserId = userIds[0]; // Super Admin

  // ============================================
  // STEP 3: Create Chart of Accounts
  // ============================================
  console.log("\n📊 Creating Chart of Accounts...");

  const coaMap = new Map<string, mongoose.Types.ObjectId>();

  // First pass: Create all accounts without parent references
  for (const coa of CHART_OF_ACCOUNTS) {
    const coaDoc = await ChartOfAccountModel.create({
      companyId,
      code: coa.code,
      name: coa.name,
      type: coa.type,
      isActive: true,
    });
    coaMap.set(coa.code, coaDoc._id as mongoose.Types.ObjectId);
  }

  // Second pass: Update parent references
  for (const coa of CHART_OF_ACCOUNTS) {
    if (coa.parent) {
      const parentId = coaMap.get(coa.parent);
      const coaId = coaMap.get(coa.code);
      if (parentId && coaId) {
        await ChartOfAccountModel.updateOne({ _id: coaId }, { $set: { parentId } });
      }
    }
  }

  console.log(`   ✓ Created ${CHART_OF_ACCOUNTS.length} accounts`);

  // ============================================
  // STEP 4: Create Departments
  // ============================================
  console.log("\n🏢 Creating Departments...");

  const deptMap = new Map<string, mongoose.Types.ObjectId>();

  for (const dept of DEPARTMENTS) {
    const deptDoc = await DepartmentModel.create({
      companyId,
      name: dept.name,
      description: dept.description,
      isActive: true,
    });
    deptMap.set(dept.name, deptDoc._id as mongoose.Types.ObjectId);
  }

  console.log(`   ✓ Created ${DEPARTMENTS.length} departments`);

  // ============================================
  // STEP 5: Create Cost Centers
  // ============================================
  console.log("\n💰 Creating Cost Centers...");

  const ccMap = new Map<string, mongoose.Types.ObjectId>();

  for (const cc of COST_CENTERS) {
    const ccDoc = await CostCenterModel.create({
      companyId,
      code: cc.code,
      name: cc.name,
      description: cc.description,
      isActive: true,
    });
    ccMap.set(cc.code, ccDoc._id as mongoose.Types.ObjectId);
  }

  console.log(`   ✓ Created ${COST_CENTERS.length} cost centers`);

  // ============================================
  // STEP 6: Create Employees
  // ============================================
  console.log("\n👥 Creating Employees...");

  const employeeIds: mongoose.Types.ObjectId[] = [];

  for (const emp of EMPLOYEES_DATA) {
    const deptId = deptMap.get(emp.dept);
    const ccId = ccMap.get("CC-001"); // Default to Head Office

    const empDoc = await EmployeeModel.create({
      companyId,
      nik: emp.nik,
      name: emp.name,
      email: emp.email,
      npwp: emp.npwp,
      bpjsNumber: `BPJS-${emp.nik}`,
      departmentId: deptId,
      costCenterId: ccId,
      employmentStatus: emp.status,
      joinDate: new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
      salaryConfig: {
        basicSalary: toDecimal128(emp.basic),
        allowances: [
          { name: "Tunjangan Transport", amount: toDecimal128(emp.basic * 0.1) },
          { name: "Tunjangan Makan", amount: toDecimal128(emp.basic * 0.05) },
        ],
        deductions: [],
        bpjsKesehatan: true,
        bpjsKetenagakerjaan: true,
        ptkpStatus: emp.ptkp,
      },
      isActive: true,
    });

    employeeIds.push(empDoc._id as mongoose.Types.ObjectId);
  }

  console.log(`   ✓ Created ${EMPLOYEES_DATA.length} employees`);

  // ============================================
  // STEP 7: Create Revenue Transactions (3 months)
  // ============================================
  console.log("\n💵 Creating Revenue transactions...");

  const revenueAccountId = coaMap.get("4110")!; // Pendapatan Jasa Konsultasi
  const bankAccountId = coaMap.get("1112")!; // Bank BCA
  const taxPayableId = coaMap.get("2123")!; // Utang PPN

  const revenueData = [
    { customer: "PT Teknologi Indonesia", source: "Jasa Konsultasi", amount: 150000000, tax: 16500000 },
    { customer: "CV Mitra Abadi", source: "Jasa IT Support", amount: 75000000, tax: 8250000 },
    { customer: "PT Global Solusi", source: "Implementasi ERP", amount: 250000000, tax: 27500000 },
    { customer: "PT Data Prima", source: "Jasa Training", amount: 45000000, tax: 4950000 },
    { customer: "CV Karya Mandiri", source: "Software License", amount: 35000000, tax: 3850000 },
    { customer: "PT Inovasi Digital", source: "Jasa Konsultasi", amount: 120000000, tax: 13200000 },
    { customer: "PT Sukses Bersama", source: "Pengembangan Aplikasi", amount: 180000000, tax: 19800000 },
    { customer: "CV Jaya Sentosa", source: "Jasa IT Support", amount: 55000000, tax: 6050000 },
    { customer: "PT Maju Terus", source: "Jasa Training", amount: 65000000, tax: 7150000 },
  ];

  let journalSeq = 1;
  let invoiceSeq = 1;

  for (let monthOffset = 2; monthOffset >= 0; monthOffset--) {
    const transactionsThisMonth = revenueData.slice(monthOffset * 3, (monthOffset + 1) * 3);

    for (const rev of transactionsThisMonth) {
      const date = getRandomDate(monthOffset);
      const journalNo = generateJournalNo("JV", journalSeq++);
      const invoiceNo = generateInvoiceNo(invoiceSeq++);
      const total = rev.amount + rev.tax;

      // Create journal first
      const journal = await JournalEntryModel.create({
        companyId,
        journalNo,
        date,
        description: `Pendapatan: ${rev.customer} - ${rev.source}`,
        source: "REVENUE",
        status: "POSTED",
        lines: [
          { accountId: bankAccountId, debit: toDecimal128(total), credit: toDecimal128(0), description: "Kas Masuk" },
          { accountId: revenueAccountId, debit: toDecimal128(0), credit: toDecimal128(rev.amount), description: "Pendapatan Jasa" },
          { accountId: taxPayableId, debit: toDecimal128(0), credit: toDecimal128(rev.tax), description: "PPN Keluaran" },
        ],
        createdBy: adminUserId,
      });

      // Create revenue record
      await RevenueModel.create({
        companyId,
        source: rev.source,
        customer: rev.customer,
        invoiceNumber: invoiceNo,
        amount: toDecimal128(rev.amount),
        tax: toDecimal128(rev.tax),
        paymentMethod: "BANK_TRANSFER",
        status: "PAID",
        journalId: journal._id,
        date,
        createdBy: adminUserId,
      });
    }
  }

  console.log(`   ✓ Created ${revenueData.length} revenue transactions with journals`);

  // ============================================
  // STEP 8: Create Expense Transactions (3 months)
  // ============================================
  console.log("\n💸 Creating Expense transactions...");

  const expenseAccountMap = {
    "Sewa Kantor": coaMap.get("6210")!,
    "Listrik & Air": coaMap.get("6220")!,
    "Internet": coaMap.get("6230")!,
    "ATK": coaMap.get("6240")!,
    "Perjalanan Dinas": coaMap.get("6310")!,
    "Komputer & IT": coaMap.get("1250")!, // Asset
  };
  const cashAccountId = coaMap.get("1111")!; // Kas Kecil

  const expenseData = [
    { vendor: "PT Graha Properti", category: "Sewa Kantor", amount: 35000000, tax: 3850000 },
    { vendor: "PLN", category: "Listrik & Air", amount: 8500000, tax: 0 },
    { vendor: "PT Telkom", category: "Internet", amount: 4500000, tax: 495000 },
    { vendor: "CV Office Supply", category: "ATK", amount: 2500000, tax: 275000 },
    { vendor: "PT Travel Agent", category: "Perjalanan Dinas", amount: 15000000, tax: 0 },
    { vendor: "PT Komputer Jaya", category: "Komputer & IT", amount: 45000000, tax: 4950000 },
    { vendor: "PLN", category: "Listrik & Air", amount: 9200000, tax: 0 },
    { vendor: "PT Telkom", category: "Internet", amount: 4500000, tax: 495000 },
    { vendor: "CV Office Supply", category: "ATK", amount: 3200000, tax: 352000 },
    { vendor: "PLN", category: "Listrik & Air", amount: 8800000, tax: 0 },
    { vendor: "PT Telkom", category: "Internet", amount: 4500000, tax: 495000 },
    { vendor: "CV Office Supply", category: "ATK", amount: 1800000, tax: 198000 },
  ];

  for (let monthOffset = 2; monthOffset >= 0; monthOffset--) {
    const transactionsThisMonth = expenseData.slice(monthOffset * 4, (monthOffset + 1) * 4);

    for (const exp of transactionsThisMonth) {
      const date = getRandomDate(monthOffset);
      const journalNo = generateJournalNo("JV", journalSeq++);
      const total = exp.amount + exp.tax;
      const expenseAccountId = expenseAccountMap[exp.category as keyof typeof expenseAccountMap];

      // Create journal first
      const journalLines = [
        { accountId: expenseAccountId, debit: toDecimal128(exp.amount), credit: toDecimal128(0), description: exp.category },
      ];

      if (exp.tax > 0) {
        const ppnMasukId = coaMap.get("1142")!; // Use prepaid for input PPN
        journalLines.push({ accountId: ppnMasukId, debit: toDecimal128(exp.tax), credit: toDecimal128(0), description: "PPN Masukan" });
      }

      journalLines.push({ accountId: bankAccountId, debit: toDecimal128(0), credit: toDecimal128(total), description: "Kas Keluar" });

      const journal = await JournalEntryModel.create({
        companyId,
        journalNo,
        date,
        description: `Pengeluaran: ${exp.vendor} - ${exp.category}`,
        source: "EXPENSE",
        status: "POSTED",
        lines: journalLines,
        createdBy: adminUserId,
      });

      // Create expense record
      await ExpenseModel.create({
        companyId,
        vendor: exp.vendor,
        category: exp.category,
        amount: toDecimal128(exp.amount),
        tax: toDecimal128(exp.tax),
        approvalStatus: "APPROVED",
        journalId: journal._id,
        date,
        createdBy: adminUserId,
      });
    }
  }

  console.log(`   ✓ Created ${expenseData.length} expense transactions with journals`);

  // ============================================
  // STEP 9: Create Payroll (1 month processed)
  // ============================================
  console.log("\n💰 Creating Payroll...");

  const now = new Date();
  const payrollMonth = now.getMonth(); // Current month (0-indexed)
  const payrollYear = now.getFullYear();

  // Calculate totals
  let totalGross = new Decimal(0);
  let totalNett = new Decimal(0);
  let totalTax = new Decimal(0);
  let totalBpjs = new Decimal(0);

  const payrollSlipsData: Array<{
    employeeId: mongoose.Types.ObjectId;
    basicSalary: number;
    allowancesTotal: number;
    deductionsTotal: number;
    bpjsKesehatan: number;
    bpjsKetenagakerjaan: number;
    pph21: number;
    netSalary: number;
  }> = [];

  for (let i = 0; i < EMPLOYEES_DATA.length; i++) {
    const emp = EMPLOYEES_DATA[i];
    const basic = emp.basic;
    const allowances = basic * 0.15; // 15% allowances
    const gross = basic + allowances;

    // Calculate BPJS (simplified)
    const bpjsKes = gross * 0.01; // 1% employee
    const bpjsKet = gross * 0.02; // 2% employee JHT
    const totalBpjsEmp = bpjsKes + bpjsKet;

    // Calculate PPh21 (simplified TER approximation)
    const annualizedGross = gross * 12;
    let pph21Rate = 0;
    if (annualizedGross <= 60000000) pph21Rate = 0;
    else if (annualizedGross <= 250000000) pph21Rate = 0.05;
    else if (annualizedGross <= 500000000) pph21Rate = 0.15;
    else pph21Rate = 0.25;

    const pph21 = gross * pph21Rate;
    const netSalary = gross - totalBpjsEmp - pph21;

    payrollSlipsData.push({
      employeeId: employeeIds[i],
      basicSalary: basic,
      allowancesTotal: allowances,
      deductionsTotal: 0,
      bpjsKesehatan: bpjsKes,
      bpjsKetenagakerjaan: bpjsKet,
      pph21,
      netSalary,
    });

    totalGross = totalGross.plus(gross);
    totalNett = totalNett.plus(netSalary);
    totalTax = totalTax.plus(pph21);
    totalBpjs = totalBpjs.plus(totalBpjsEmp);
  }

  // Create payroll journal
  const payrollJournalNo = generateJournalNo("PAY", 1);
  const salaryExpenseId = coaMap.get("6110")!; // Beban Gaji Pokok
  const allowanceExpenseId = coaMap.get("6120")!; // Beban Tunjangan
  const bpjsExpenseId = coaMap.get("6130")!; // Beban BPJS Perusahaan
  const pph21PayableId = coaMap.get("2121")!; // Utang PPh 21
  const bpjsPayableId = coaMap.get("2141")!; // Utang BPJS Kesehatan
  const salaryPayableId = coaMap.get("2130")!; // Utang Gaji

  const payrollDate = new Date(payrollYear, payrollMonth, 25);

  const payrollJournal = await JournalEntryModel.create({
    companyId,
    journalNo: payrollJournalNo,
    date: payrollDate,
    description: `Payroll Bulan ${payrollMonth + 1}/${payrollYear}`,
    source: "PAYROLL",
    status: "POSTED",
    lines: [
      { accountId: salaryExpenseId, debit: toDecimal128(totalGross.toNumber() * 0.87), credit: toDecimal128(0), description: "Gaji Pokok" },
      { accountId: allowanceExpenseId, debit: toDecimal128(totalGross.toNumber() * 0.13), credit: toDecimal128(0), description: "Tunjangan" },
      { accountId: bpjsExpenseId, debit: toDecimal128(totalBpjs.toNumber() * 2), credit: toDecimal128(0), description: "BPJS Perusahaan" },
      { accountId: pph21PayableId, debit: toDecimal128(0), credit: toDecimal128(totalTax.toNumber()), description: "PPh 21" },
      { accountId: bpjsPayableId, debit: toDecimal128(0), credit: toDecimal128(totalBpjs.toNumber() * 3), description: "BPJS" },
      { accountId: salaryPayableId, debit: toDecimal128(0), credit: toDecimal128(totalNett.toNumber()), description: "Gaji Terutang" },
    ],
    createdBy: adminUserId,
  });

  // Create payroll record
  const payroll = await PayrollModel.create({
    companyId,
    periodMonth: payrollMonth + 1,
    periodYear: payrollYear,
    totalGross: toDecimal128(totalGross.toNumber()),
    totalNett: toDecimal128(totalNett.toNumber()),
    totalTax: toDecimal128(totalTax.toNumber()),
    totalBpjs: toDecimal128(totalBpjs.toNumber()),
    status: "PROCESSED",
    journalId: payrollJournal._id,
  });

  // Create payroll slips
  for (const slip of payrollSlipsData) {
    await PayrollSlipModel.create({
      payrollId: payroll._id,
      employeeId: slip.employeeId,
      basicSalary: toDecimal128(slip.basicSalary),
      allowancesTotal: toDecimal128(slip.allowancesTotal),
      deductionsTotal: toDecimal128(slip.deductionsTotal),
      bpjsKesehatanAmount: toDecimal128(slip.bpjsKesehatan),
      bpjsKetenagakerjaanAmount: toDecimal128(slip.bpjsKetenagakerjaan),
      pph21Amount: toDecimal128(slip.pph21),
      netSalary: toDecimal128(slip.netSalary),
    });
  }

  console.log(`   ✓ Created payroll for ${payrollMonth + 1}/${payrollYear} with ${EMPLOYEES_DATA.length} slips`);

  // ============================================
  // STEP 10: Create Opening Balance Journal
  // ============================================
  console.log("\n📝 Creating opening balance journal...");

  const openingJournalNo = generateJournalNo("OB", 1);
  const openingDate = new Date(payrollYear, 0, 1); // Jan 1st
  const equityAccountId = coaMap.get("3100")!; // Modal Disetor

  await JournalEntryModel.create({
    companyId,
    journalNo: openingJournalNo,
    date: openingDate,
    description: "Saldo Awal - Modal Disetor",
    source: "MANUAL",
    status: "POSTED",
    lines: [
      { accountId: bankAccountId, debit: toDecimal128(500000000), credit: toDecimal128(0), description: "Kas Bank BCA" },
      { accountId: cashAccountId, debit: toDecimal128(50000000), credit: toDecimal128(0), description: "Kas Kecil" },
      { accountId: equityAccountId, debit: toDecimal128(0), credit: toDecimal128(550000000), description: "Modal Pemilik" },
    ],
    createdBy: adminUserId,
  });

  console.log(`   ✓ Created opening balance journal`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log("\n" + "=".repeat(60));
  console.log("✅ SEED COMPLETED SUCCESSFULLY!");
  console.log("=".repeat(60));
  console.log("\n📋 LOGIN CREDENTIALS:");
  console.log("-".repeat(40));
  for (const user of USERS_DATA) {
    console.log(`   ${user.role.padEnd(15)} | ${user.email}`);
  }
  console.log(`   Password      | ${DEFAULT_PASSWORD}`);
  console.log("-".repeat(40));
  console.log("\n📊 DATA CREATED:");
  console.log(`   Company:      ${COMPANY_DATA.name}`);
  console.log(`   Users:        ${USERS_DATA.length}`);
  console.log(`   COA Accounts: ${CHART_OF_ACCOUNTS.length}`);
  console.log(`   Departments:  ${DEPARTMENTS.length}`);
  console.log(`   Cost Centers: ${COST_CENTERS.length}`);
  console.log(`   Employees:    ${EMPLOYEES_DATA.length}`);
  console.log(`   Revenues:     ${revenueData.length}`);
  console.log(`   Expenses:     ${expenseData.length}`);
  console.log(`   Journals:     ${journalSeq + 2}`);
  console.log(`   Payroll:      1 (${payrollMonth + 1}/${payrollYear})`);
  console.log("-".repeat(40));
  console.log("\n🌐 Access the dashboard at: http://localhost:3000");
  console.log("\n");

  process.exit(0);
}

// Run the seed
seedProduction().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
