import { AuditLogModel } from "@/infrastructure/database/models/AuditLog";
import mongoose, { Document, Model } from "mongoose";

interface LogActionParams {
  companyId: string;
  userId: string;
  action: string;
  module: string;
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
}

/**
 * Log an action to the audit log
 */
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
      ipAddress: params.ipAddress,
    });

    await log.save({ session });
  } catch (error) {
    console.error("Failed to save audit log:", error);
    // Don't throw error to avoid breaking main business flow
  }
}

/**
 * Audit change helper - captures old value before update and logs after
 * @param model - Mongoose model
 * @param companyId - Company ID for tenant isolation
 * @param resourceId - Document ID being updated
 * @param userId - User performing the action
 * @param moduleName - Module name for audit log
 * @param updateFn - Function that performs the update and returns the new value
 * @param action - Action name (default: UPDATE)
 */
export async function auditChange<T extends Document>(
  model: Model<T>,
  companyId: string,
  resourceId: string,
  userId: string,
  moduleName: string,
  updateFn: () => Promise<T | null>,
  action: string = "UPDATE",
  session?: mongoose.ClientSession
): Promise<T | null> {
  // Capture old value before update
  const oldDoc = await model.findOne({
    _id: resourceId,
    companyId: new mongoose.Types.ObjectId(companyId),
  } as mongoose.FilterQuery<T>).lean();

  // Perform the update
  const newDoc = await updateFn();

  // Log the change with both old and new values
  if (oldDoc || newDoc) {
    await logAction(
      {
        companyId,
        userId,
        action,
        module: moduleName,
        resourceId,
        oldValue: oldDoc ? sanitizeForAudit(oldDoc) : undefined,
        newValue: newDoc ? sanitizeForAudit(newDoc) : undefined,
      },
      session
    );
  }

  return newDoc;
}

/**
 * Audit deletion helper - captures value before delete
 */
export async function auditDelete<T extends Document>(
  model: Model<T>,
  companyId: string,
  resourceId: string,
  userId: string,
  moduleName: string,
  deleteFn: () => Promise<boolean>,
  session?: mongoose.ClientSession
): Promise<boolean> {
  // Capture old value before delete
  const oldDoc = await model.findOne({
    _id: resourceId,
    companyId: new mongoose.Types.ObjectId(companyId),
  } as mongoose.FilterQuery<T>).lean();

  // Perform the delete
  const deleted = await deleteFn();

  // Log the deletion with old value
  if (oldDoc) {
    await logAction(
      {
        companyId,
        userId,
        action: "DELETE",
        module: moduleName,
        resourceId,
        oldValue: sanitizeForAudit(oldDoc),
      },
      session
    );
  }

  return deleted;
}

/**
 * Sanitize document for audit logging
 * Removes internal MongoDB fields and sensitive data
 */
function sanitizeForAudit(doc: unknown): unknown {
  if (!doc || typeof doc !== "object") return doc;

  const sanitized = { ...doc } as Record<string, unknown>;
  
  // Remove internal MongoDB fields
  delete sanitized.__v;
  
  // Convert ObjectIds to strings for readability
  for (const key of Object.keys(sanitized)) {
    const value = sanitized[key];
    if (value instanceof mongoose.Types.ObjectId) {
      sanitized[key] = value.toString();
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      // Check if it looks like an ObjectId
      const objValue = value as Record<string, unknown>;
      if (objValue._bsontype === "ObjectId" || objValue.$oid) {
        sanitized[key] = String(value);
      }
    }
  }

  // Remove sensitive fields
  delete sanitized.password;
  delete sanitized.passwordHash;

  return sanitized;
}

/**
 * Get audit log history for a resource
 */
export async function getAuditHistory(
  companyId: string,
  resourceId: string,
  limit: number = 50
): Promise<Array<{
  action: string;
  module: string;
  userId: string;
  oldValue: unknown;
  newValue: unknown;
  createdAt: Date;
}>> {
  const logs = await AuditLogModel.find({
    companyId: new mongoose.Types.ObjectId(companyId),
    resourceId,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "name email")
    .lean();

  return logs.map(log => ({
    action: log.action,
    module: log.module,
    userId: log.userId?.toString() || "",
    oldValue: log.oldValue,
    newValue: log.newValue,
    createdAt: log.createdAt,
  }));
}

/**
 * Compute diff between old and new values for audit display
 */
export function computeAuditDiff(
  oldValue: Record<string, unknown> | null | undefined,
  newValue: Record<string, unknown> | null | undefined
): Array<{ field: string; old: unknown; new: unknown }> {
  const diffs: Array<{ field: string; old: unknown; new: unknown }> = [];
  
  if (!oldValue && !newValue) return diffs;
  
  const old = oldValue || {};
  const cur = newValue || {};
  const allKeys = new Set([...Object.keys(old), ...Object.keys(cur)]);
  
  // Fields to skip in diff
  const skipFields = ["_id", "companyId", "createdAt", "updatedAt", "__v"];
  
  for (const key of allKeys) {
    if (skipFields.includes(key)) continue;
    
    const oldVal = old[key];
    const newVal = cur[key];
    
    // Simple comparison (won't work for nested objects, but good for most cases)
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({ field: key, old: oldVal, new: newVal });
    }
  }
  
  return diffs;
}
