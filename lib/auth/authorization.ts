import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businesses, businessUsers, users } from "@/db/schema";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/auth/audit";
import { selectActiveMembership } from "@/lib/auth/business-context";
import { logServerEvent } from "@/lib/observability/logger";

const ACTIVE_BUSINESS_HEADER = "x-kuba-business-id";

export class AuthorizationError extends Error {
  constructor(public readonly status: 401 | 403 | 409, public readonly code: string, message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export type AuthorizedBusinessContext = {
  user: { id: string; name: string; email: string };
  membership: typeof businessUsers.$inferSelect;
  business: typeof businesses.$inferSelect;
};

export async function requireAuth() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new AuthorizationError(401, "UNAUTHORIZED", "Authentication is required.");
  return session.user;
}

export async function requireBusinessContext(request?: Request): Promise<AuthorizedBusinessContext> {
  const user = await requireAuth();
  const memberships = await db.select().from(businessUsers).where(eq(businessUsers.userId, user.id));
  if (memberships.length === 0) throw new AuthorizationError(403, "BUSINESS_ACCESS_DENIED", "Business access is required.");

  const requestedBusinessId = (request?.headers.get(ACTIVE_BUSINESS_HEADER) ?? (await headers()).get(ACTIVE_BUSINESS_HEADER))?.trim();
  const membership = selectActiveMembership(memberships, requestedBusinessId);

  if (!membership) {
    throw new AuthorizationError(
      requestedBusinessId ? 403 : 409,
      requestedBusinessId ? "BUSINESS_ACCESS_DENIED" : "BUSINESS_CONTEXT_REQUIRED",
      requestedBusinessId ? "You do not have access to the requested business." : "Select an active business before continuing.",
    );
  }

  const business = (await db.select().from(businesses).where(eq(businesses.id, membership.businessId)).limit(1))[0];
  if (!business) throw new AuthorizationError(403, "BUSINESS_ACCESS_DENIED", "Business access is required.");
  return { user, membership, business };
}

export const getActiveBusinessForUser = requireBusinessContext;

export async function requirePermission(permission: Permission, request?: Request) {
  const context = await requireBusinessContext(request);
  if (!hasPermission(context.membership.role, context.membership.permissions, permission)) {
    throw new AuthorizationError(403, "PERMISSION_DENIED", "You do not have permission to perform this action.");
  }
  return context;
}

export async function requireSuperAdmin() {
  const sessionUser = await requireAuth();
  const user = (await db.select({ id: users.id, platformRole: users.platformRole }).from(users).where(eq(users.id, sessionUser.id)).limit(1))[0];
  if (!user || user.platformRole !== "super_admin") {
    throw new AuthorizationError(403, "SUPER_ADMIN_REQUIRED", "Super Admin access is required.");
  }
  return user;
}

export function authorizationErrorResponse(error: unknown) {
  if (!(error instanceof AuthorizationError)) return null;
  return Response.json({ error: error.code, message: error.message }, { status: error.status });
}

export async function logSecurityEvent({ context, request, action, resource, resourceId = null, result }: {
  context: AuthorizedBusinessContext;
  request: Request;
  action: string;
  resource: string;
  resourceId?: string | null;
  result: "success" | "denied" | "failure";
}) {
  try {
    await createAuditLog({
      businessId: context.business.id,
      userId: context.user.id,
      action,
      resource,
      resourceId,
      metadata: { result, timestamp: new Date().toISOString() },
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: request.headers.get("user-agent"),
    });
  } catch (error) {
    logServerEvent({ event: "security_audit_log.failure", level: "error", businessId: context.business.id, actorId: context.user.id, error });
  }
}
