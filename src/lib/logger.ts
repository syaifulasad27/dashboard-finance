import { AuditLogModel } from "@/infrastructure/database/models/AuditLog";
import mongoose from "mongoose";

interface LogActionParams {
  companyId: string;
  userId: string;
  action: string;
  module: string;
  resourceId?: string;
  oldValue?: any;
  newValue?: any;
}

export async function logAction(params: LogActionParams, session?: mongoose.ClientSession) {
  try {
    const log = new AuditLogModel({
      companyId: new mongoose.Types.ObjectId(params.companyId),
      userId: new mongoose.Types.ObjectId(params.userId),
      action: params.action,
      module: params.module,
      resourceId: params.resourceId,
      oldValue: params.oldValue,
      newValue: params.newValue,
    });

    await log.save({ session });
  } catch (error) {
    console.error("Failed to save audit log:", error);
    // Don't throw error to avoid breaking main business flow
  }
}
