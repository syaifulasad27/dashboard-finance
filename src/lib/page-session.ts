import { getOptionalSessionContext, getSessionContext, SessionContext, AuthorizationError } from "@/lib/session";
import { redirect } from "next/navigation";

/**
 * Get session for a server component page
 * Redirects to login if not authenticated
 */
export async function getPageSession(): Promise<SessionContext> {
  const session = await getOptionalSessionContext();
  
  if (!session) {
    redirect("/login");
  }
  
  return session;
}

/**
 * Require authentication for server actions
 * Throws AuthorizationError if not authenticated
 * Returns session context with typed user property for convenience
 */
export async function requireAuth(): Promise<SessionContext & { user: { id: string; name: string; role: string } }> {
  const session = await getSessionContext();
  return {
    ...session,
    user: {
      id: session.userId,
      name: session.name,
      role: session.role,
    },
  };
}

/**
 * Get session for a server component page with role check
 * Redirects to login or shows forbidden message
 */
export async function getPageSessionWithRole(
  allowedRoles: SessionContext["role"][]
): Promise<SessionContext> {
  const session = await getPageSession();
  
  if (!allowedRoles.includes(session.role)) {
    // Could redirect to an unauthorized page instead
    throw new Error(`Access denied. Required roles: ${allowedRoles.join(", ")}`);
  }
  
  return session;
}
