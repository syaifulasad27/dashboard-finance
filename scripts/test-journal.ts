import mongoose from "mongoose";
import { connectToDatabase } from "../src/infrastructure/database/mongodb";
import { AccountingEngine } from "../src/core/engines/accounting.engine";
import { ChartOfAccountModel } from "../src/infrastructure/database/models/ChartOfAccount";

async function runTest() {
  await connectToDatabase();
  const companyId = "60d5ecb8b392d22b28f745d0";

  // Ambil beberapa akun COA yang tadi sudah di-seed
  const bankAccount = await ChartOfAccountModel.findOne({ code: "1100" });
  const ownerEquity = await ChartOfAccountModel.findOne({ code: "3000" });
  const revenueAccount = await ChartOfAccountModel.findOne({ code: "4000" });

  console.log("Mencatat Jurnal 1: Setoran Modal Awal");
  await AccountingEngine.recordTransaction({
    companyId,
    date: new Date(),
    description: "Setoran Modal Awal Owner",
    source: "MANUAL",
    createdBy: "60d5ecb8b392d22b28f745d1", // mock userId
    lines: [
      { accountId: bankAccount._id.toString(), debit: 500000000, credit: 0, description: "Bank BCA" },
      { accountId: ownerEquity._id.toString(), debit: 0, credit: 500000000, description: "Modal Disetor" },
    ]
  });

  console.log("Mencatat Jurnal 2: Pendapatan Layanan");
  await AccountingEngine.recordTransaction({
    companyId,
    date: new Date(),
    description: "Pendapatan Jasa Konsultasi",
    source: "REVENUE",
    createdBy: "60d5ecb8b392d22b28f745d1",
    lines: [
      { accountId: bankAccount._id.toString(), debit: 15000000, credit: 0 },
      { accountId: revenueAccount._id.toString(), debit: 0, credit: 15000000 },
    ]
  });

  console.log("Simulasi selesai! Silahkan refresh browser dashboard anda.");
  process.exit(0);
}

runTest();
