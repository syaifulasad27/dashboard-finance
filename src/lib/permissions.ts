import { SessionContext, UserRole, ForbiddenError } from "@/lib/session";

/**
 * Available resources in the system
 */
export type Resource = 
  | "JOURNAL"
  | "REVENUE"
  | "EXPENSE"
  | "PAYROLL"
  | "EMPLOYEE"
  | "REPORT"
  | "COA"
  | "COMPANY"
  | "USER"
  | "AUDIT_LOG"
  | "APPROVAL_CONFIG"
  | "EXCHANGE_RATE"
  | "COST_CENTER"
  | "DEPARTMENT"
  | "PROJECT"
  | "BUDGET";

/**
 * Available actions
 */
export type Action = "CREATE" | "READ" | "UPDATE" | "DELETE" | "APPROVE" | "VOID" | "POST";

/**
 * Permission matrix defining which roles can perform which actions on which resources
 */
const PERMISSION_MATRIX: Record<UserRole, Record<Resource, Action[]>> = {
  SUPER_ADMIN: {
    JOURNAL: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "VOID", "POST"],
    REVENUE: ["CREATE", "READ", "UPDATE", "DELETE", "VOID"],
    EXPENSE: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "VOID"],
    PAYROLL: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    EMPLOYEE: ["CREATE", "READ", "UPDATE", "DELETE"],
    REPORT: ["READ"],
    COA: ["CREATE", "READ", "UPDATE", "DELETE"],
    COMPANY: ["CREATE", "READ", "UPDATE", "DELETE"],
    USER: ["CREATE", "READ", "UPDATE", "DELETE"],
    AUDIT_LOG: ["READ"],
    APPROVAL_CONFIG: ["CREATE", "READ", "UPDATE", "DELETE"],
    EXCHANGE_RATE: ["CREATE", "READ", "UPDATE", "DELETE"],
    COST_CENTER: ["CREATE", "READ", "UPDATE", "DELETE"],
    DEPARTMENT: ["CREATE", "READ", "UPDATE", "DELETE"],
    PROJECT: ["CREATE", "READ", "UPDATE", "DELETE"],
    BUDGET: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
  },
  FINANCE_ADMIN: {
    JOURNAL: ["CREATE", "READ", "UPDATE", "VOID", "POST"],
    REVENUE: ["CREATE", "READ", "UPDATE", "VOID"],
    EXPENSE: ["CREATE", "READ", "UPDATE", "APPROVE", "VOID"],
    PAYROLL: ["READ"],
    EMPLOYEE: ["READ"],
    REPORT: ["READ"],
    COA: ["CREATE", "READ", "UPDATE"],
    COMPANY: ["READ"],
    USER: ["READ"],
    AUDIT_LOG: ["READ"],
    APPROVAL_CONFIG: ["READ"],
    EXCHANGE_RATE: ["CREATE", "READ", "UPDATE"],
    COST_CENTER: ["CREATE", "READ", "UPDATE"],
    DEPARTMENT: ["READ"],
    PROJECT: ["CREATE", "READ", "UPDATE"],
    BUDGET: ["CREATE", "READ", "UPDATE", "APPROVE"],
  },
  HR_ADMIN: {
    JOURNAL: ["READ"],
    REVENUE: ["READ"],
    EXPENSE: ["CREATE", "READ"],
    PAYROLL: ["CREATE", "READ", "UPDATE", "APPROVE"],
    EMPLOYEE: ["CREATE", "READ", "UPDATE", "DELETE"],
    REPORT: ["READ"],
    COA: ["READ"],
    COMPANY: ["READ"],
    USER: ["READ"],
    AUDIT_LOG: ["READ"],
    APPROVAL_CONFIG: ["READ"],
    EXCHANGE_RATE: ["READ"],
    COST_CENTER: ["READ"],
    DEPARTMENT: ["CREATE", "READ", "UPDATE"],
    PROJECT: ["READ"],
    BUDGET: ["READ"],
  },
  AUDITOR: {
    JOURNAL: ["READ"],
    REVENUE: ["READ"],
    EXPENSE: ["READ"],
    PAYROLL: ["READ"],
    EMPLOYEE: ["READ"],
    REPORT: ["READ"],
    COA: ["READ"],
    COMPANY: ["READ"],
    USER: ["READ"],
    AUDIT_LOG: ["READ"],
    APPROVAL_CONFIG: ["READ"],
    EXCHANGE_RATE: ["READ"],
    COST_CENTER: ["READ"],
    DEPARTMENT: ["READ"],
    PROJECT: ["READ"],
    BUDGET: ["READ"],
  },
  VIEWER: {
    JOURNAL: ["READ"],
    REVENUE: ["READ"],
    EXPENSE: ["READ"],
    PAYROLL: [],
    EMPLOYEE: [],
    REPORT: ["READ"],
    COA: ["READ"],
    COMPANY: [],
    USER: [],
    AUDIT_LOG: [],
    APPROVAL_CONFIG: [],
    EXCHANGE_RATE: [],
    COST_CENTER: [],
    DEPARTMENT: [],
    PROJECT: ["READ"],
    BUDGET: ["READ"],
  },
};

/**
 * Check if a role has permission for a specific action on a resource
 */
export function hasPermission(
  role: UserRole,
  resource: Resource,
  action: Action
): boolean {
  const rolePermissions = PERMISSION_MATRIX[role];
  if (!rolePermissions) return false;

  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) return false;

  return resourcePermissions.includes(action);
}

/**
 * Check if session has permission
 */
export function checkPermission(
  session: SessionContext,
  resource: Resource,
  action: Action
): boolean {
  return hasPermission(session.role, resource, action);
}

/**
 * Require permission - throws ForbiddenError if not allowed
 */
export function requirePermission(
  session: SessionContext,
  resource: Resource,
  action: Action
): void {
  if (!checkPermission(session, resource, action)) {
    throw new ForbiddenError(
      `Permission denied: ${session.role} cannot ${action} ${resource}`
    );
  }
}

/**
 * Decorator-style permission check for server actions
 * Returns a function that wraps the action with permission check
 */
export function withPermission<T extends any[], R>(
  resource: Resource,
  action: Action,
  fn: (session: SessionContext, ...args: T) => Promise<R>
): (session: SessionContext, ...args: T) => Promise<R> {
  return async (session: SessionContext, ...args: T) => {
    requirePermission(session, resource, action);
    return fn(session, ...args);
  };
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Record<Resource, Action[]> {
  return PERMISSION_MATRIX[role] || {};
}

/**
 * Get all resources a role can access for a specific action
 */
export function getAccessibleResources(role: UserRole, action: Action): Resource[] {
  const permissions = PERMISSION_MATRIX[role];
  if (!permissions) return [];

  return (Object.entries(permissions) as [Resource, Action[]][])
    .filter(([, actions]) => actions.includes(action))
    .map(([resource]) => resource);
}
