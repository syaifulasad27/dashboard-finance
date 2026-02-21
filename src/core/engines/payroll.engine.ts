import mongoose from "mongoose";
import Decimal from "decimal.js";
import { AccountingEngine } from "./accounting.engine";
import { EmployeeModel } from "@/infrastructure/database/models/Employee";
import { PayrollModel } from "@/infrastructure/database/models/Payroll";
import { PayrollSlipModel } from "@/infrastructure/database/models/PayrollSlip";
import { ChartOfAccountModel } from "@/infrastructure/database/models/ChartOfAccount";
import { TaxEngine } from "./tax.engine";

// Flat rates for simplified BPJS calculation (Enterprise versions would query BpjsConfig collection)
const BPJS_KESEHATAN_RATE = new Decimal(0.01); // 1% employee paid
const BPJS_KETENAGAKERJAAN_RATE = new Decimal(0.02); // 2% employee paid JHT

export class PayrollEngine {
  static async processMonthlyPayroll(companyId: string, periodMonth: number, periodYear: number, adminId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Check if payroll for this period already exists
      const existing = await PayrollModel.findOne({ companyId, periodMonth, periodYear }).session(session);
      if (existing) {
        throw new Error(`Payroll for ${periodMonth}/${periodYear} has already been processed.`);
      }

      // 2. Fetch all active employees
      const employees = await EmployeeModel.find({ companyId, isActive: true }).session(session);
      if (employees.length === 0) throw new Error("No active employees found to process.");

      let totalGrossAll = new Decimal(0);
      let totalNettAll = new Decimal(0);
      let totalTaxAll = new Decimal(0);
      let totalBpjsAll = new Decimal(0);

      const slipsData = [];

      // 3. Process calculations per employee
      for (const emp of employees) {
        const config = emp.salaryConfig;
        const basic = new Decimal(config.basicSalary.toString());

        // Sum allowances
        const allowancesSum = config.allowances.reduce(
          (sum: Decimal, a: any) => sum.plus(new Decimal(a.amount.toString())),
          new Decimal(0)
        );

        // Sum deductions
        const deductionsSum = config.deductions.reduce(
          (sum: Decimal, d: any) => sum.plus(new Decimal(d.amount.toString())),
          new Decimal(0)
        );

        const gross = basic.plus(allowancesSum);

        // BPJS Deductions
        let bpjsKes = new Decimal(0);
        let bpjsKet = new Decimal(0);

        // Base for BPJS is usually basic + fixed allowance. Simplifying to basic for MVP
        if (config.bpjsKesehatan) bpjsKes = basic.mul(BPJS_KESEHATAN_RATE);
        if (config.bpjsKetenagakerjaan) bpjsKet = basic.mul(BPJS_KETENAGAKERJAAN_RATE);

        const totalBpjsDec = bpjsKes.plus(bpjsKet);

        // Tax Calculation
        const annualizedGross = gross.mul(12).toNumber();
        const pph21Dec = new Decimal(TaxEngine.calculateMonthlyPph21(annualizedGross, config.ptkpStatus));

        const net = gross.minus(deductionsSum).minus(totalBpjsDec).minus(pph21Dec);

        // Accumulate company totals
        totalGrossAll = totalGrossAll.plus(gross);
        totalNettAll = totalNettAll.plus(net);
        totalTaxAll = totalTaxAll.plus(pph21Dec);
        totalBpjsAll = totalBpjsAll.plus(totalBpjsDec);

        slipsData.push({
          employeeId: emp._id,
          basicSalary: mongoose.Types.Decimal128.fromString(basic.toString()),
          allowancesTotal: mongoose.Types.Decimal128.fromString(allowancesSum.toString()),
          deductionsTotal: mongoose.Types.Decimal128.fromString(deductionsSum.toString()),
          bpjsKesehatanAmount: mongoose.Types.Decimal128.fromString(bpjsKes.toString()),
          bpjsKetenagakerjaanAmount: mongoose.Types.Decimal128.fromString(bpjsKet.toString()),
          pph21Amount: mongoose.Types.Decimal128.fromString(pph21Dec.toString()),
          netSalary: mongoose.Types.Decimal128.fromString(net.toString()),
        });
      }

      // 4. Create Payroll Batch Record
      const payrollBatch = new PayrollModel({
        companyId: new mongoose.Types.ObjectId(companyId),
        periodMonth,
        periodYear,
        totalGross: mongoose.Types.Decimal128.fromString(totalGrossAll.toString()),
        totalNett: mongoose.Types.Decimal128.fromString(totalNettAll.toString()),
        totalTax: mongoose.Types.Decimal128.fromString(totalTaxAll.toString()),
        totalBpjs: mongoose.Types.Decimal128.fromString(totalBpjsAll.toString()),
        status: "PROCESSED"
      });

      await payrollBatch.save({ session });

      // 5. Insert Slips
      const slipsToInsert = slipsData.map(slip => ({
        ...slip,
        payrollId: payrollBatch._id
      }));
      await PayrollSlipModel.insertMany(slipsToInsert, { session });

      // 6. Automated Accounting Journal
      const bankAccount = await ChartOfAccountModel.findOne({ companyId, code: "1100" }).session(session); // Bank
      const salaryExpAccount = await ChartOfAccountModel.findOne({ companyId, code: "5100" }).session(session); // Using 5100 as proxy for Salary Expense for MVP
      const taxPayableAccount = await ChartOfAccountModel.findOne({ companyId, code: "2100" }).session(session); // Tax Payable Liability
      const bpjsPayableAccount = await ChartOfAccountModel.findOne({ companyId, code: "2100" }).session(session); // BPJS Payable (Proxy to Liability 2100)

      if (!bankAccount || !salaryExpAccount || !taxPayableAccount) {
        throw new Error("Missing required Chart of Accounts (1100, 5100, 2100) for generating Payroll Journal.");
      }

      const journal = await AccountingEngine.recordTransaction({
        companyId,
        date: new Date(periodYear, periodMonth - 1, 28), // Usually end of month
        source: "PAYROLL",
        description: `Automated Payroll Salary Expense for Period ${periodMonth}/${periodYear}`,
        createdBy: adminId,
        lines: [
          // Debit the total gross expense
          { accountId: salaryExpAccount._id.toString(), debit: totalGrossAll.toString(), credit: 0 },

          // Credit liabilities & bank
          { accountId: taxPayableAccount._id.toString(), debit: 0, credit: totalTaxAll.toString() },
          { accountId: bpjsPayableAccount._id.toString(), debit: 0, credit: totalBpjsAll.toString() },
          { accountId: bankAccount._id.toString(), debit: 0, credit: totalNettAll.toString() }
        ]
      }, session);

      payrollBatch.journalId = journal._id as mongoose.Types.ObjectId;
      payrollBatch.status = "PAID"; // Auto mark as paid for MVP simplicity
      await payrollBatch.save({ session });

      await session.commitTransaction();
      return { success: true, batchId: payrollBatch._id };

    } catch (error: any) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}
