import mongoose from "mongoose";
import { connectToDatabase } from "../src/infrastructure/database/mongodb";
import { EmployeeModel } from "../src/infrastructure/database/models/Employee";
import { ChartOfAccountModel } from "../src/infrastructure/database/models/ChartOfAccount";

async function seedEmployees() {
  await connectToDatabase();
  const companyId = "60d5ecb8b392d22b28f745d0";

  // Membersihkan data lama & Jurnal penggajian bulan ini (untuk idempoten testing)
  await EmployeeModel.deleteMany({ companyId });

  // Memastikan master COA ada: 5100 (Salary Exp) dan 2100 (Utang Pajak/BPJS) - ini untuk test engine
  const existing5100 = await ChartOfAccountModel.findOne({ companyId, code: "5100" });
  if (!existing5100) {
    await ChartOfAccountModel.create({
      companyId, code: "5100", name: "Salary Expense", type: "Expense", balance: 0
    })
  }

  const existing2100 = await ChartOfAccountModel.findOne({ companyId, code: "2100" });
  if (!existing2100) {
    await ChartOfAccountModel.create({
      companyId, code: "2100", name: "Tax & Payable Liability", type: "Liability", balance: 0
    })
  }

  const employees = [
    {
      companyId,
      nik: "EMP-001",
      name: "Budi Santoso",
      email: "budi@kukerja.id",
      employmentStatus: "PERMANENT",
      joinDate: new Date("2023-01-15"),
      salaryConfig: {
        basicSalary: mongoose.Types.Decimal128.fromString("15000000"),
        allowances: [
          { name: "Transport", amount: mongoose.Types.Decimal128.fromString("1500000") }
        ],
        deductions: [],
        bpjsKesehatan: true,
        bpjsKetenagakerjaan: true,
        ptkpStatus: "K/1"
      }
    },
    {
      companyId,
      nik: "EMP-002",
      name: "Siti Aminah",
      email: "siti@kukerja.id",
      employmentStatus: "CONTRACT",
      joinDate: new Date("2024-05-10"),
      salaryConfig: {
        basicSalary: mongoose.Types.Decimal128.fromString("8000000"),
        allowances: [],
        deductions: [],
        bpjsKesehatan: true,
        bpjsKetenagakerjaan: true,
        ptkpStatus: "TK/0"
      }
    }
  ];

  await EmployeeModel.insertMany(employees);
  console.log("Seeded 2 dummy employees successfully.");
  process.exit(0);
}

seedEmployees();
