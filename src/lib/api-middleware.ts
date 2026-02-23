import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { hasPermission, Resource, Action } from "@/lib/permissions";
import { connectToDatabase } from "@/infrastructure/database/mongodb";
import { UserModel } from "@/infrastructure/database/models/User";
import { UserRole } from "@/lib/session";

export interface ApiContext {
  userId: string;
  companyId: string;
  role: UserRole;
}

/**
 * Validate API request authentication via session or API key
 * Returns user context or error response
 */
export async function validateApiRequest(): Promise<
  | { success: true; context: ApiContext }
  | { success: false; response: NextResponse }
> {
  const headersList = await headers();
  
  // Check for API key authentication first
  const apiKey = headersList.get("x-api-key");
  const companyId = headersList.get("x-company-id");
  
  if (apiKey && companyId) {
    // TODO: Implement API key validation against stored keys
    // For now, we'll use session-based auth only
    return {
      success: false,
      response: NextResponse.json(
        { error: "API key authentication not yet implemented" },
        { status: 501 }
      ),
    };
  }

  // Fall back to session-based authentication
  try {
    const session = await auth.api.getSession({
      headers: headersList,
    });

    if (!session?.user?.id || !session?.user?.email) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "Unauthorized - No valid session" },
          { status: 401 }
        ),
      };
    }

    // Fetch user from database to get companyId and role
    await connectToDatabase();
    const user = await UserModel.findOne({ email: session.user.email }).lean();

    if (!user || !user.companyId) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "User not found or not associated with a company" },
          { status: 401 }
        ),
      };
    }

    return {
      success: true,
      context: {
        userId: user._id.toString(),
        companyId: user.companyId.toString(),
        role: user.role as UserRole,
      },
    };
  } catch (error) {
    console.error("API auth error:", error);
    return {
      success: false,
      response: NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      ),
    };
  }
}

/**
 * Check API permission and return error response if denied
 */
export function checkApiPermission(
  context: ApiContext,
  resource: Resource,
  action: Action
): NextResponse | null {
  const canAccess = hasPermission(context.role, resource, action);
  
  if (!canAccess) {
    return NextResponse.json(
      { error: `Permission denied for ${action} on ${resource}` },
      { status: 403 }
    );
  }
  
  return null;
}

/**
 * Standard API error response
 */
export function apiError(message: string, status: number = 500): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Standard API success response
 */
export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Parse pagination params from request
 */
export function parsePagination(request: NextRequest): {
  page: number;
  limit: number;
  skip: number;
} {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}

/**
 * Parse date range params from request
 */
export function parseDateRange(request: NextRequest): {
  startDate?: Date;
  endDate?: Date;
} {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  
  return {
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  };
}
