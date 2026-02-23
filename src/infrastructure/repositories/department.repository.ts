import mongoose, { ClientSession } from "mongoose";
import { BaseRepository } from "./base.repository";
import { DepartmentModel, IDepartment } from "@/infrastructure/database/models/Department";

export class DepartmentRepository extends BaseRepository<IDepartment> {
  constructor() {
    super(DepartmentModel);
  }

  /**
   * Find active departments
   */
  async findActive(companyId: string, session?: ClientSession): Promise<IDepartment[]> {
    return this.find(companyId, { isActive: true }, { sort: { name: 1 }, session });
  }

  /**
   * Find by name
   */
  async findByName(
    companyId: string,
    name: string,
    session?: ClientSession
  ): Promise<IDepartment | null> {
    return this.findOne(companyId, { name }, { session });
  }

  /**
   * Find with manager populated
   */
  async findWithManagers(companyId: string, session?: ClientSession): Promise<IDepartment[]> {
    return this.find(
      companyId,
      {},
      { sort: { name: 1 }, populate: "managerId", session }
    );
  }

  /**
   * Toggle active status
   */
  async toggleActive(
    companyId: string,
    departmentId: string,
    session?: ClientSession
  ): Promise<IDepartment | null> {
    await this.ensureConnection();

    const department = await this.findById(companyId, departmentId, { session });
    if (!department) return null;

    return this.updateById(
      companyId,
      departmentId,
      { $set: { isActive: !department.isActive } },
      session
    );
  }

  /**
   * Check if name exists
   */
  async nameExists(
    companyId: string,
    name: string,
    excludeId?: string,
    session?: ClientSession
  ): Promise<boolean> {
    await this.ensureConnection();

    const filter: Record<string, unknown> = { name };
    if (excludeId) {
      filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    const existing = await this.findOne(companyId, filter, { session });
    return !!existing;
  }

  /**
   * Get department employee count (requires Employee collection)
   */
  async getDepartmentStats(
    companyId: string,
    session?: ClientSession
  ): Promise<Array<{ departmentId: string; name: string; employeeCount: number }>> {
    await this.ensureConnection();

    // This would need to be a lookup with Employee collection
    // For now, return basic department list
    const departments = await this.find(companyId, { isActive: true }, { session });
    return departments.map(d => ({
      departmentId: (d._id as mongoose.Types.ObjectId).toString(),
      name: d.name,
      employeeCount: 0, // Would need Employee aggregate
    }));
  }
}

export const departmentRepository = new DepartmentRepository();
