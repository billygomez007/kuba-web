import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, businessUsers, businesses, organizationMembers, organizations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { createAuditLog } from "@/lib/auth/audit";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!await isPlatformAdmin(session.user.id)) return { error: NextResponse.json({ error: "Platform admin access required." }, { status: 403 }) };
  return { session };
}

/**
 * Identity + both membership axes for one user — read-only, so a platform
 * admin can see enough to make a promotion decision without guessing (which
 * businesses they already belong to, which portfolios). Never used as an
 * authorization signal itself; it's a display aggregation only.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin();
  if (access.error) return access.error;
  const { id } = await context.params;

  const user = (await db.select({ id: users.id, name: users.name, email: users.email, platformRole: users.platformRole, status: users.status, createdAt: users.createdAt }).from(users).where(eq(users.id, id)).limit(1))[0];
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const [businessMemberships, organizationMemberships] = await Promise.all([
    db.select({ businessId: businessUsers.businessId, businessName: businesses.name, role: businessUsers.role, plan: businesses.plan })
      .from(businessUsers)
      .innerJoin(businesses, eq(businessUsers.businessId, businesses.id))
      .where(eq(businessUsers.userId, id)),
    db.select({ organizationId: organizationMembers.organizationId, organizationName: organizations.name, role: organizationMembers.role })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, id)),
  ]);

  return NextResponse.json({ user, businessMemberships, organizationMemberships });
}

// The three roles lib/auth/platform-admin.ts's isPlatformAdmin() already
// recognizes as full platform-admin access — no new role/hierarchy is
// introduced here. They are flat/equal in the existing architecture (none
// of them individually rank higher than another anywhere in the codebase);
// "user" is included so this route can also revoke a grant.
const GRANTABLE_PLATFORM_ROLES = ["user", "platform_admin", "super_admin", "system_operator"] as const;

/**
 * Grants (or revokes) a platform-wide role. This is deliberately the ONLY
 * mechanism to do so through the running application — any existing
 * platform admin can promote another authenticated user, fully audited.
 * The very first platform admin (when none yet exists) cannot come from
 * this route, since it is itself gated by isPlatformAdmin(); see
 * scripts/bootstrap-platform-admin.mjs for that one-time, non-HTTP case.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin();
  if (access.error) return access.error;
  const session = access.session;

  const { id: targetUserId } = await context.params;
  const body = await request.json();
  const platformRole = typeof body.platformRole === "string" ? body.platformRole : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!reason) return NextResponse.json({ error: "A reason is required." }, { status: 400 });
  if (!(GRANTABLE_PLATFORM_ROLES as readonly string[]).includes(platformRole)) {
    return NextResponse.json({ error: `platformRole must be one of: ${GRANTABLE_PLATFORM_ROLES.join(", ")}.` }, { status: 400 });
  }

  const target = (await db.select({ id: users.id, email: users.email, platformRole: users.platformRole }).from(users).where(eq(users.id, targetUserId)).limit(1))[0];
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  await db.update(users).set({ platformRole, updatedAt: new Date() }).where(eq(users.id, targetUserId));

  // businessId is not applicable to a platform-wide (non-business-scoped)
  // action — "platform" is the documented sentinel for this audit action,
  // not a real business id.
  await createAuditLog({
    businessId: "platform",
    userId: session.user.id,
    action: "admin.platform_role.changed",
    resource: "user",
    resourceId: targetUserId,
    description: reason,
    metadata: { targetEmail: target.email, fromRole: target.platformRole, toRole: platformRole },
  });

  return NextResponse.json({ success: true, userId: targetUserId, platformRole });
}
