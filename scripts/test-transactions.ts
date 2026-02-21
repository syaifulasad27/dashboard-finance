import mongoose from "mongoose";
import { connectToDatabase } from "../src/infrastructure/database/mongodb";
import { AccountingEngine } from "../src/core/engines/accounting.engine";
import { ChartOfAccountModel } from "../src/infrastructure/database/models/ChartOfAccount";
import { RevenueModel } from "../src/infrastructure/database/models/Revenue";
import { ExpenseModel } from "../src/infrastructure/database/models/Expense";

async function runSeed() {
  await connectToDatabase();
  const companyId = "60d5ecb8b392d22b28f745d0";
  const adminId = "60d5ecb8b392d22b28f745d1";

  // Clean old simulated records to run fresh
  await RevenueModel.deleteMany({ companyId });
  await ExpenseModel.deleteMany({ companyId });

  // Ambil beberapa akun COA yang tadi sudah di-seed
  const bankAccount = await ChartOfAccountModel.findOne({ code: "1100" });
  const revenueAccount = await ChartOfAccountModel.findOne({ code: "4000" });
  const expenseAccount = await ChartOfAccountModel.findOne({ code: "5100" });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("Menyuntikan Data Simulasi Revenue & Auto Journal...");

    // Manual Revenue creation without API
    const amountRev = 25000000;
    const revRecord = new RevenueModel({
      companyId,
      source: "Software Implementation",
      customer: "PT Bumi Makmur",
      invoiceNumber: "INV-2026-001",
      amount: mongoose.Types.Decimal128.fromString(amountRev.toString()),
      paymentMethod: "BANK_TRANSFER",
      date: new Date(),
      createdBy: adminId
    });

    const journalRev = await AccountingEngine.recordTransaction({
      companyId,
      date: new Date(),
      description: `Revenue Software Implementation - Inv: INV-2026-001`,
      source: "REVENUE",
      lines: [
        { accountId: bankAccount._id.toString(), debit: amountRev, credit: 0 },
        { accountId: revenueAccount._id.toString(), debit: 0, credit: amountRev },
      ],
      createdBy: adminId
    }, session);

    revRecord.journalId = journalRev._id as mongoose.Types.ObjectId;
    await revRecord.save({ session });


    console.log("Menyuntikan Data Simulasi Expense & Auto Journal...");

    // Manual Expense
    const amountExp = 5000000;
    const expRecord = new ExpenseModel({
      companyId,
      vendor: "AWS Cloud Services",
      category: "Server Hosting",
      amount: mongoose.Types.Decimal128.fromString(amountExp.toString()),
      approvalStatus: "APPROVED",
      date: new Date(),
      createdBy: adminId
    });

    const journalExp = await AccountingEngine.recordTransaction({
      companyId,
      date: new Date(),
      description: `Expense Server Hosting - Vendor: AWS Cloud Services`,
      source: "EXPENSE",
      lines: [
        { accountId: expenseAccount._id.toString(), debit: amountExp, credit: 0 },
        { accountId: bankAccount._id.toString(), debit: 0, credit: amountExp },
      ],
      createdBy: adminId
    }, session);

    expRecord.journalId = journalExp._id as mongoose.Types.ObjectId;
    await expRecord.save({ session });

    await session.commitTransaction();
    console.log("Simulasi Revenue & Expense berhasil disimpan.");
  } catch (error) {
    console.error("Gagal menyuntikan seed data:", error);
    await session.abortTransaction();
  } finally {
    session.endSession();
    process.exit(0);
  }
}

runSeed();
