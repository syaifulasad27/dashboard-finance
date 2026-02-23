import mongoose, { ClientSession } from "mongoose";
import { BaseRepository } from "./base.repository";
import { EmployeeModel, IEmployee } from "@/infrastructure/database/models/Employee";

export class EmployeeRepository extends BaseRepository<IEmployee> {
  constructor() {
    super(EmployeeModel);
  }

  /**
   * Find all active employees for a company
   */
  async findActiveEmployees(
    companyId: string,
    session?: ClientSession
  ): Promise<IEmployee[]> {
    return this.find(companyId, { isActive: true }, { session });
  }

  /**
   * Find employee by NIK
   */
  async findByNik(
    companyId: string,
    nik: string,
    session?: ClientSession
  ): Promise<IEmployee | null> {
    return this.findOne(companyId, { nik }, { session });
  }

  /**
   * Find employees by department
   */
  async findByDepartment(
    companyId: string,
    departmentId: string,
    session?: ClientSession
  ): Promise<IEmployee[]> {
    return this.find(
      companyId,
      { departmentId: new mongoose.Types.ObjectId(departmentId), isActive: true },
      { session }
    );
  }

  /**
   * Update salary configuration
   */
  async updateSalaryConfig(
    companyId: string,
    employeeId: string,
    salaryConfig: IEmployee["salaryConfig"],
    session?: ClientSession
  ): Promise<IEmployee | null> {
    return this.updateById(
      companyId,
      employeeId,
      { $set: { salaryConfig } },
      session
    );
  }

  /**
   * Deactivate employee (soft delete)
   */
  async deactivate(
    companyId: string,
    employeeId: string,
    session?: ClientSession
  ): Promise<IEmployee | null> {
    return this.updateById(
      companyId,
      employeeId,
      { $set: { isActive: false } },
      session
    );
  }
}

// Export singleton instance
export const employeeRepository = new EmployeeRepository();
