import mongoose, { ClientSession } from "mongoose";
import { BaseRepository } from "./base.repository";
import { PayrollModel, IPayroll } from "@/infrastructure/database/models/Payroll";
import { PayrollSlipModel, IPayrollSlip } from "@/infrastructure/database/models/PayrollSlip";

export class PayrollRepository extends BaseRepository<IPayroll> {
  constructor() {
    super(PayrollModel);
  }

  /**
   * Find payroll by period
   */
  async findByPeriod(
    companyId: string,
    periodMonth: number,
    periodYear: number,
    session?: ClientSession
  ): Promise<IPayroll | null> {
    return this.findOne(companyId, { periodMonth, periodYear }, { session });
  }

  /**
   * Find payrolls by year
   */
  async findByYear(
    companyId: string,
    year: number,
    session?: ClientSession
  ): Promise<IPayroll[]> {
    return this.find(
      companyId,
      { periodYear: year },
      { sort: { periodMonth: -1 }, session }
    );
  }

  /**
   * Get payroll history with pagination
   */
  async getHistory(
    companyId: string,
    limit: number = 12,
    skip: number = 0
  ): Promise<IPayroll[]> {
    return this.find(
      companyId,
      {},
      { limit, skip, sort: { periodYear: -1, periodMonth: -1 } }
    );
  }

  /**
   * Link journal to payroll
   */
  async linkJournal(
    companyId: string,
    payrollId: string,
    journalId: string,
    session?: ClientSession
  ): Promise<IPayroll | null> {
    return this.updateById(
      companyId,
      payrollId,
      {
        $set: {
          journalId: new mongoose.Types.ObjectId(journalId),
          status: "PAID"
        }
      },
      session
    );
  }

  /**
   * Update payroll status
   */
  async updateStatus(
    companyId: string,
    payrollId: string,
    status: IPayroll["status"],
    session?: ClientSession
  ): Promise<IPayroll | null> {
    return this.updateById(companyId, payrollId, { $set: { status } }, session);
  }
}

export class PayrollSlipRepository {
  /**
   * Create multiple payroll slips in one batch
   */
  async createMany(
    slips: Array<Omit<IPayrollSlip, "_id" | "createdAt">>,
    session?: ClientSession
  ): Promise<IPayrollSlip[]> {
    const result = await PayrollSlipModel.insertMany(slips, { session });
    return result;
  }

  /**
   * Find slips by payroll ID
   */
  async findByPayrollId(
    payrollId: string,
    session?: ClientSession
  ): Promise<IPayrollSlip[]> {
    let query = PayrollSlipModel.find({ payrollId: new mongoose.Types.ObjectId(payrollId) });
    if (session) query = query.session(session);
    return query.populate("employeeId").lean();
  }

  /**
   * Find slip by employee and payroll
   */
  async findByEmployeeAndPayroll(
    employeeId: string,
    payrollId: string,
    session?: ClientSession
  ): Promise<IPayrollSlip | null> {
    let query = PayrollSlipModel.findOne({
      employeeId: new mongoose.Types.ObjectId(employeeId),
      payrollId: new mongoose.Types.ObjectId(payrollId)
    });
    if (session) query = query.session(session);
    return query.lean();
  }
}

// Export singleton instances
export const payrollRepository = new PayrollRepository();
export const payrollSlipRepository = new PayrollSlipRepository();
