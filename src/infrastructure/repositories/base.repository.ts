import mongoose, { Document, Model, UpdateQuery, ClientSession } from "mongoose";
import { connectToDatabase } from "@/infrastructure/database/mongodb";

// Type alias for filter query compatible with mongoose 9.x
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
type FilterQuery<T> = Record<string, any>;

/**
 * Base repository class that enforces tenant isolation
 * All repositories must extend this class
 */
export abstract class BaseRepository<T extends Document> {
  protected model: Model<T>;
  protected tenantField: string = "companyId";

  constructor(model: Model<T>) {
    this.model = model;
  }

  /**
   * Ensure database connection before any operation
   */
  protected async ensureConnection(): Promise<void> {
    await connectToDatabase();
  }

  /**
   * Add tenant filter to query - CRITICAL for data isolation
   */
  protected withTenant(companyId: string, filter: FilterQuery<T> = {}): FilterQuery<T> {
    return {
      ...filter,
      [this.tenantField]: new mongoose.Types.ObjectId(companyId),
    } as FilterQuery<T>;
  }

  /**
   * Find documents with tenant isolation
   */
  async find(
    companyId: string,
    filter: FilterQuery<T> = {},
    options?: {
      limit?: number;
      skip?: number;
      sort?: Record<string, 1 | -1>;
      populate?: string | string[];
      session?: ClientSession;
    }
  ): Promise<T[]> {
    await this.ensureConnection();
    
    let query = this.model.find(this.withTenant(companyId, filter));
    
    if (options?.limit) query = query.limit(options.limit);
    if (options?.skip) query = query.skip(options.skip);
    if (options?.sort) query = query.sort(options.sort);
    if (options?.populate) query = query.populate(options.populate);
    if (options?.session) query = query.session(options.session);
    
    return query.lean() as Promise<T[]>;
  }

  /**
   * Find one document with tenant isolation
   */
  async findOne(
    companyId: string,
    filter: FilterQuery<T> = {},
    options?: {
      populate?: string | string[];
      session?: ClientSession;
    }
  ): Promise<T | null> {
    await this.ensureConnection();
    
    let query = this.model.findOne(this.withTenant(companyId, filter));
    
    if (options?.populate) query = query.populate(options.populate);
    if (options?.session) query = query.session(options.session);
    
    return query.lean() as Promise<T | null>;
  }

  /**
   * Find by ID with tenant isolation
   */
  async findById(
    companyId: string,
    id: string,
    options?: {
      populate?: string | string[];
      session?: ClientSession;
      includeDeleted?: boolean;
    }
  ): Promise<T | null> {
    await this.ensureConnection();
    
    const filter = this.withTenant(companyId, { _id: new mongoose.Types.ObjectId(id) } as FilterQuery<T>);
    
    // Exclude soft-deleted unless explicitly requested
    if (!options?.includeDeleted) {
      (filter as Record<string, unknown>).deletedAt = { $in: [null, undefined] };
    }
    
    let query = this.model.findOne(filter);
    
    if (options?.populate) query = query.populate(options.populate);
    if (options?.session) query = query.session(options.session);
    
    return query.lean() as Promise<T | null>;
  }

  /**
   * Create a document with tenant enforcement
   */
  async create(
    companyId: string,
    data: Partial<T>,
    session?: ClientSession
  ): Promise<T> {
    await this.ensureConnection();
    
    const docData = {
      ...data,
      [this.tenantField]: new mongoose.Types.ObjectId(companyId),
    };
    
    const doc = new this.model(docData);
    await doc.save({ session });
    
    return doc.toObject() as T;
  }

  /**
   * Update a document with tenant isolation
   */
  async updateById(
    companyId: string,
    id: string,
    update: UpdateQuery<T>,
    session?: ClientSession
  ): Promise<T | null> {
    await this.ensureConnection();
    
    const result = await this.model.findOneAndUpdate(
      this.withTenant(companyId, { _id: new mongoose.Types.ObjectId(id) } as FilterQuery<T>),
      update,
      { new: true, session }
    ).lean();
    
    return result as T | null;
  }

  /**
   * Soft delete a document (sets deletedAt timestamp)
   */
  async softDelete(
    companyId: string,
    id: string,
    deletedBy?: string,
    session?: ClientSession
  ): Promise<T | null> {
    await this.ensureConnection();
    
    const update: Record<string, unknown> = {
      deletedAt: new Date(),
    };
    if (deletedBy) {
      update.deletedBy = new mongoose.Types.ObjectId(deletedBy);
    }
    
    const result = await this.model.findOneAndUpdate(
      this.withTenant(companyId, { _id: new mongoose.Types.ObjectId(id) } as FilterQuery<T>),
      { $set: update },
      { new: true, session }
    ).lean();
    
    return result as T | null;
  }

  /**
   * Restore a soft-deleted document
   */
  async restore(
    companyId: string,
    id: string,
    session?: ClientSession
  ): Promise<T | null> {
    await this.ensureConnection();
    
    const result = await this.model.findOneAndUpdate(
      this.withTenant(companyId, { 
        _id: new mongoose.Types.ObjectId(id),
        deletedAt: { $ne: null }
      } as FilterQuery<T>),
      { $set: { deletedAt: null, deletedBy: null } },
      { new: true, session }
    ).lean();
    
    return result as T | null;
  }

  /**
   * Hard delete (permanent) - use with caution
   */
  async deleteById(
    companyId: string,
    id: string,
    session?: ClientSession
  ): Promise<boolean> {
    await this.ensureConnection();
    
    const result = await this.model.deleteOne(
      this.withTenant(companyId, { _id: new mongoose.Types.ObjectId(id) } as FilterQuery<T>),
      { session }
    );
    
    return result.deletedCount > 0;
  }

  /**
   * Find soft-deleted documents
   */
  async findDeleted(
    companyId: string,
    filter: FilterQuery<T> = {},
    options?: {
      sort?: Record<string, 1 | -1>;
      limit?: number;
      skip?: number;
      session?: ClientSession;
    }
  ): Promise<T[]> {
    await this.ensureConnection();
    
    const queryFilter = this.withTenant(companyId, {
      ...filter,
      deletedAt: { $ne: null },
    } as FilterQuery<T>);
    
    let query = this.model.find(queryFilter);
    
    if (options?.sort) query = query.sort(options.sort);
    if (options?.limit) query = query.limit(options.limit);
    if (options?.skip) query = query.skip(options.skip);
    if (options?.session) query = query.session(options.session);
    
    return query.lean() as Promise<T[]>;
  }

  /**
   * Count documents with tenant isolation
   */
  async count(companyId: string, filter: FilterQuery<T> = {}): Promise<number> {
    await this.ensureConnection();
    const queryFilter = this.withTenant(companyId, filter);
    // Exclude soft-deleted by default
    (queryFilter as Record<string, unknown>).deletedAt = { $in: [null, undefined] };
    return this.model.countDocuments(queryFilter);
  }

  /**
   * Check if document exists with tenant isolation
   */
  async exists(companyId: string, filter: FilterQuery<T>): Promise<boolean> {
    await this.ensureConnection();
    const queryFilter = this.withTenant(companyId, filter);
    // Exclude soft-deleted by default
    (queryFilter as Record<string, unknown>).deletedAt = { $in: [null, undefined] };
    const count = await this.model.countDocuments(queryFilter);
    return count > 0;
  }
}
