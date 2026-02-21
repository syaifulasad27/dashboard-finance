import mongoose from "mongoose";
import { connectToDatabase } from "../src/infrastructure/database/mongodb";
import { ChartOfAccountModel } from "../src/infrastructure/database/models/ChartOfAccount";

async function runSeed() {
  await connectToDatabase();

  const companyId = new mongoose.Types.ObjectId("60d5ecb8b392d22b28f745d0");

  const defaultCOAs = [
    { companyId, code: "1000", name: "Cash on Hand", type: "ASSET" },
    { companyId, code: "1100", name: "Bank Account", type: "ASSET" },
    { companyId, code: "2000", name: "Accounts Payable", type: "LIABILITY" },
    { companyId, code: "2100", name: "PPh21 Payable", type: "LIABILITY" },
    { companyId, code: "3000", name: "Owner Equity", type: "EQUITY" },
    { companyId, code: "4000", name: "Sales Revenue", type: "REVENUE" },
    { companyId, code: "5000", name: "Salary Expense", type: "EXPENSE" },
    { companyId, code: "5100", name: "Office Expense", type: "EXPENSE" },
  ];

  await ChartOfAccountModel.deleteMany({ companyId });
  await ChartOfAccountModel.insertMany(defaultCOAs);

  console.log("Seeding complete: Master COA injected.");
  process.exit(0);
}

runSeed();
