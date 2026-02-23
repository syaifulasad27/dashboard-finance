import mongoose, { Schema, Query, Document, Model } from "mongoose";

// Type alias for filter query compatible with mongoose 9.x
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
type FilterQuery<T> = Record<string, any>;

/**
 * Soft Delete Plugin for Mongoose
 * Adds deletedAt field and modifies queries to exclude soft-deleted documents
 */

export interface ISoftDelete {
  deletedAt?: Date | null;
  deletedBy?: mongoose.Types.ObjectId | null;
  isDeleted?: boolean;
}

export interface SoftDeleteModel<T extends Document> extends Model<T> {
  /**
   * Soft delete a document
   */
  softDelete(
    id: string | mongoose.Types.ObjectId,
    deletedBy?: string
  ): Promise<T | null>;

  /**
   * Restore a soft-deleted document
   */
  restore(id: string | mongoose.Types.ObjectId): Promise<T | null>;

  /**
   * Find including soft-deleted documents
   */
  findWithDeleted(
    filter?: FilterQuery<T>
  ): mongoose.Query<T[], T>;

  /**
   * Find only soft-deleted documents
   */
  findDeleted(
    filter?: FilterQuery<T>
  ): mongoose.Query<T[], T>;

  /**
   * Hard delete (permanent)
   */
  hardDelete(id: string | mongoose.Types.ObjectId): Promise<boolean>;
}

/**
 * Add soft delete fields to schema
 */
export function addSoftDeleteFields(schema: Schema): void {
  schema.add({
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  });

  // Virtual for isDeleted
  schema.virtual("isDeleted").get(function (this: ISoftDelete) {
    return this.deletedAt !== null;
  });
}

/**
 * Apply soft delete middleware to schema
 * This modifies find queries to exclude soft-deleted documents by default
 */
export function applySoftDeleteMiddleware(schema: Schema): void {
  // List of query methods to modify
  const queryMethods = [
    "find",
    "findOne",
    "findOneAndUpdate",
    "countDocuments",
    "updateMany",
    "updateOne",
  ] as const;

  for (const method of queryMethods) {
    schema.pre(method, function (this: Query<unknown, unknown>) {
      // Skip if explicitly including deleted
      const options = this.getOptions() as { includeDeleted?: boolean };
      if (options.includeDeleted) return;

      // Only add filter if not already specified
      const filter = this.getFilter();
      if (filter.deletedAt === undefined) {
        this.where({ deletedAt: null });
      }
    });
  }

  // For aggregate, add $match stage
  schema.pre("aggregate", function () {
    // Check if first stage already filters deletedAt
    const pipeline = this.pipeline();
    const firstStage = pipeline[0] as { $match?: { deletedAt?: unknown } } | undefined;
    
    if (!firstStage?.$match?.deletedAt) {
      this.pipeline().unshift({ $match: { deletedAt: null } });
    }
  });
}

/**
 * Add soft delete static methods to schema
 */
export function addSoftDeleteMethods<T extends Document>(schema: Schema): void {
  // Soft delete a document
  schema.statics.softDelete = async function (
    id: string | mongoose.Types.ObjectId,
    deletedBy?: string
  ): Promise<T | null> {
    const update: ISoftDelete = {
      deletedAt: new Date(),
    };
    if (deletedBy) {
      update.deletedBy = new mongoose.Types.ObjectId(deletedBy);
    }

    return this.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).setOptions({ includeDeleted: true });
  };

  // Restore a soft-deleted document
  schema.statics.restore = async function (
    id: string | mongoose.Types.ObjectId
  ): Promise<T | null> {
    return this.findByIdAndUpdate(
      id,
      { $set: { deletedAt: null, deletedBy: null } },
      { new: true }
    ).setOptions({ includeDeleted: true });
  };

  // Find including deleted
  schema.statics.findWithDeleted = function (
    filter: FilterQuery<T> = {}
  ): mongoose.Query<T[], T> {
    return this.find(filter).setOptions({ includeDeleted: true });
  };

  // Find only deleted
  schema.statics.findDeleted = function (
    filter: FilterQuery<T> = {}
  ): mongoose.Query<T[], T> {
    return this.find({ ...filter, deletedAt: { $ne: null } }).setOptions({
      includeDeleted: true,
    });
  };

  // Hard delete
  schema.statics.hardDelete = async function (
    id: string | mongoose.Types.ObjectId
  ): Promise<boolean> {
    const result = await this.deleteOne({ _id: id });
    return result.deletedCount > 0;
  };
}

/**
 * Full soft delete plugin - applies all soft delete functionality
 */
export function softDeletePlugin<T extends Document>(schema: Schema): void {
  addSoftDeleteFields(schema);
  applySoftDeleteMiddleware(schema);
  addSoftDeleteMethods<T>(schema);
}

/**
 * Helper to apply soft delete to a model that already exists
 * Use this when you can't modify the schema directly
 */
export async function softDeleteDocument(
  model: Model<Document>,
  companyId: string,
  documentId: string,
  deletedBy?: string
): Promise<Document | null> {
  const update: Record<string, unknown> = {
    deletedAt: new Date(),
  };
  if (deletedBy) {
    update.deletedBy = new mongoose.Types.ObjectId(deletedBy);
  }

  return model.findOneAndUpdate(
    {
      _id: documentId,
      companyId: new mongoose.Types.ObjectId(companyId),
    },
    { $set: update },
    { new: true }
  );
}

/**
 * Helper to restore a soft-deleted document
 */
export async function restoreDocument(
  model: Model<Document>,
  companyId: string,
  documentId: string
): Promise<Document | null> {
  return model.findOneAndUpdate(
    {
      _id: documentId,
      companyId: new mongoose.Types.ObjectId(companyId),
    },
    { $set: { deletedAt: null, deletedBy: null } },
    { new: true }
  );
}
