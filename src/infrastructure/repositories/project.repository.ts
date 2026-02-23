import mongoose, { ClientSession } from "mongoose";
import { BaseRepository } from "./base.repository";
import { ProjectModel, IProject } from "@/infrastructure/database/models/Project";

export class ProjectRepository extends BaseRepository<IProject> {
  constructor() {
    super(ProjectModel);
  }

  /**
   * Find active projects
   */
  async findActive(companyId: string, session?: ClientSession): Promise<IProject[]> {
    return this.find(
      companyId,
      { isActive: true, status: { $in: ["PLANNING", "ACTIVE"] } },
      { sort: { code: 1 }, session }
    );
  }

  /**
   * Find projects by status
   */
  async findByStatus(
    companyId: string,
    status: IProject["status"],
    session?: ClientSession
  ): Promise<IProject[]> {
    return this.find(companyId, { status }, { sort: { code: 1 }, session });
  }

  /**
   * Find projects by department
   */
  async findByDepartment(
    companyId: string,
    departmentId: string,
    session?: ClientSession
  ): Promise<IProject[]> {
    return this.find(
      companyId,
      { departmentId: new mongoose.Types.ObjectId(departmentId) },
      { sort: { code: 1 }, session }
    );
  }

  /**
   * Find projects by cost center
   */
  async findByCostCenter(
    companyId: string,
    costCenterId: string,
    session?: ClientSession
  ): Promise<IProject[]> {
    return this.find(
      companyId,
      { costCenterId: new mongoose.Types.ObjectId(costCenterId) },
      { sort: { code: 1 }, session }
    );
  }

  /**
   * Update project status
   */
  async updateStatus(
    companyId: string,
    projectId: string,
    status: IProject["status"],
    session?: ClientSession
  ): Promise<IProject | null> {
    return this.updateById(companyId, projectId, { $set: { status } }, session);
  }

  /**
   * Get projects summary by status
   */
  async getStatusSummary(
    companyId: string,
    session?: ClientSession
  ): Promise<Array<{ status: string; count: number; totalBudget: number }>> {
    await this.ensureConnection();

    return ProjectModel.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyId), isActive: true } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalBudget: { $sum: { $toDouble: { $ifNull: ["$budget", 0] } } },
        },
      },
      { $project: { status: "$_id", count: 1, totalBudget: 1, _id: 0 } },
    ]).session(session || null);
  }
}

export const projectRepository = new ProjectRepository();
