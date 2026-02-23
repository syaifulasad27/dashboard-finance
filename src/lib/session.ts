import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { UserModel } from "@/infrastructure/database/models/User";
import mongoose from "mongoose";

export type UserRole = "SUPER_ADMIN" | "FINANCE_ADMIN" | "HR_ADMIN" | "AUDITOR" | "VIEWER";

export interface SessionContext {
  userId: string;
  companyId: string;
  role: UserRole;
  email: string;
  name: string;
}

export class AuthorizationError extends Error {
  constructor(message: string = "Unauthorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Get the current session context from Better Auth
 * Throws AuthorizationError if user is not authenticated
 */
export async function getSessionContext(): Promise<SessionContext> {
  try {
    // Get session from Better Auth
    const headersList = await headers();
    const cookiesList = (await cookies()).getAll();
    console.log("getSessionContext: Cookies present:", cookiesList.map(c => c.name).join(", "));

    const session = await auth.api.getSession({
      headers: headersList,
    });

    const conn = await connectToDatabase();
    console.log("getSessionContext: Better Auth session present:", !!session);
    console.log("getSessionContext: Session User:", JSON.stringify(session?.user, null, 2));

    if (!session?.user?.id) {
      console.log("getSessionContext: No session user id found");
      throw new AuthorizationError("Not authenticated");
    }

    // Fetch user from database to get companyId and role
    console.log("getSessionContext: Searching for user with email:", session.user.email);
    console.log("getSessionContext: Connected to DB:", conn.connection.name);

    // Debug: list collection names safely
    try {
      const collections = await conn.connection.db?.listCollections().toArray();
      console.log("getSessionContext: Collections in DB:", collections?.map((c: { name: string }) => c.name).join(", "));
    } catch (dbErr) {
      console.log("getSessionContext: Failed to list collections:", dbErr);
    }

    const user = await UserModel.findOne({ email: session.user.email }).lean();
    console.log("getSessionContext: DB User search complete. Found:", !!user);

    if (!user) {
      throw new AuthorizationError("User not found in database");
    }

    if (!user.companyId) {
      throw new AuthorizationError("User is not associated with any company");
    }

    return {
      userId: user._id.toString(),
      companyId: user.companyId.toString(),
      role: user.role as UserRole,
      email: user.email,
      name: user.name,
    };
  } catch (error) {
    console.error("getSessionContext error:", error);
    if (error instanceof AuthorizationError) {
      throw error;
    }
    // Don't swallow unexpected errors if possible, or at least log them clearly
    throw new AuthorizationError(error instanceof Error ? error.message : "Authentication failed");
  }
}

/**
 * Get session context or null if not authenticated
 * Use this for optional authentication scenarios
 */
export async function getOptionalSessionContext(): Promise<SessionContext | null> {
  try {
    return await getSessionContext();
  } catch {
    return null;
  }
}

/**
 * Require authentication - throws if not logged in
 */
export async function requireAuth(): Promise<SessionContext> {
  return getSessionContext();
}

/**
 * Require specific role(s) - throws ForbiddenError if user doesn't have required role
 */
export async function requireRole(...allowedRoles: UserRole[]): Promise<SessionContext> {
  const session = await requireAuth();

  if (!allowedRoles.includes(session.role)) {
    throw new ForbiddenError(`Access denied. Required roles: ${allowedRoles.join(", ")}`);
  }

  return session;
}

/**
 * Check if user has any of the specified roles
 */
export function hasRole(session: SessionContext, ...roles: UserRole[]): boolean {
  return roles.includes(session.role);
}

/**
 * Check if user is admin (SUPER_ADMIN, FINANCE_ADMIN, or HR_ADMIN)
 */
export function isAdmin(session: SessionContext): boolean {
  return hasRole(session, "SUPER_ADMIN", "FINANCE_ADMIN", "HR_ADMIN");
}

/**
 * Check if user can modify data (not VIEWER or AUDITOR)
 */
export function canModify(session: SessionContext): boolean {
  return hasRole(session, "SUPER_ADMIN", "FINANCE_ADMIN", "HR_ADMIN");
}
