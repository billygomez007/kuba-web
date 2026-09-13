import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, organizationMembers, organizationBusinesses, businesses, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { isOrganizationRole } from "@/lib/auth/organizations";
import { createAuditLog } from "@/lib/auth/audit";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!await isPlatformAdmin(session.user.id)) return { error: NextResponse.json({ error: "Platform admin access required." }, { status: 403 }) };
  return { session };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin();
  if (access.error) return access.error;
  const { id } = await context.params;

  const organization = (await db.select().from(organizations).where(eq(organizations.id, id)).limit(1))[0];
  if (!organization) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  const [memberRows, businessLinks] = await Promise.all([
    db.select({ id: organizationMembers.id, userId: organizationMembers.userId, role: organizationMembers.role, name: users.name, email: users.email })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, id)),
    db.select({ id: organizationBusinesses.id, businessId: organizationBusinesses.businessId, name: businesses.name, plan: businesses.plan, status: businesses.status })
      .from(organizationBusinesses)
      .innerJoin(businesses, eq(organizationBusinesses.businessId, businesses.id))
      .where(eq(organizationBusinesses.organizationId, id)),
  ]);

  return NextResponse.json({ organization, members: memberRows, businesses: businessLinks });
}

/**
 * Portfolio administration actions, mirroring the single-PATCH-with-action
 * convention app/api/admin/businesses/[id]/route.ts already uses.
 *
 *  - add_member:    grants a user a portfolio-level role (owner/admin/
 *                   member). Grants NO business access by itself — see
 *                   lib/auth/organizations.ts's file header.
 *  - remove_member: revokes a portfolio-level role.
 *  - link_business: associates an EXISTING business with this portfolio
 *                   (grouping/discovery metadata only, for the eventual
 *                   portfolio dashboard and switcher). Never creates a
 *                   business, never touches its subscription, never grants
 *                   anyone a businessUsers row.
 *  - unlink_business: removes that association.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin();
  if (access.error) return access.error;
  const { id: organizationId } = await context.params;

  const organization = (await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).limit(1))[0];
  if (!organization) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  const body = await request.json();
  const action = typeof body.action === "string" ? body.action : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "A reason is required." }, { status: 400 });

  if (action === "add_member") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body.role === "string" ? body.role : "member";
    if (!email) return NextResponse.json({ error: "An email is required." }, { status: 400 });
    if (!isOrganizationRole(role)) return NextResponse.json({ error: "role must be owner, admin, or member." }, { status: 400 });

    const targetUser = (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0];
    if (!targetUser) return NextResponse.json({ error: `No user found for ${email}. They must sign up first.` }, { status: 404 });

    const existing = (await db.select({ id: organizationMembers.id }).from(organizationMembers).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, targetUser.id))).limit(1))[0];
    if (existing) {
      await db.update(organizationMembers).set({ role }).where(eq(organizationMembers.id, existing.id));
    } else {
      await db.insert(organizationMembers).values({ id: crypto.randomUUID(), organizationId, userId: targetUser.id, role, createdAt: new Date() });
    }

    await createAuditLog({ businessId: "platform", userId: access.session.user.id, action: "admin.organization.member_added", resource: "organization", resourceId: organizationId, description: reason, metadata: { targetEmail: email, role } });
    return NextResponse.json({ success: true });
  }

  if (action === "remove_member") {
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });
    await db.delete(organizationMembers).where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId)));
    await createAuditLog({ businessId: "platform", userId: access.session.user.id, action: "admin.organization.member_removed", resource: "organization", resourceId: organizationId, description: reason, metadata: { targetUserId: userId } });
    return NextResponse.json({ success: true });
  }

  if (action === "link_business") {
    const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
    if (!businessId) return NextResponse.json({ error: "businessId is required." }, { status: 400 });

    const business = (await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).limit(1))[0];
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });

    const alreadyLinked = (await db.select({ organizationId: organizationBusinesses.organizationId }).from(organizationBusinesses).where(eq(organizationBusinesses.businessId, businessId)).limit(1))[0];
    if (alreadyLinked && alreadyLinked.organizationId !== organizationId) {
      return NextResponse.json({ error: "This business is already linked to a different portfolio." }, { status: 409 });
    }
    if (alreadyLinked) {
      return NextResponse.json({ success: true, alreadyLinked: true });
    }

    await db.insert(organizationBusinesses).values({ id: crypto.randomUUID(), organizationId, businessId, createdAt: new Date() });
    await createAuditLog({ businessId, userId: access.session.user.id, action: "admin.organization.business_linked", resource: "organization", resourceId: organizationId, description: reason, metadata: { businessId } });
    return NextResponse.json({ success: true });
  }

  if (action === "unlink_business") {
    const businessId = typeof body.businessId === "string" ? body.businessId.trim() : "";
    if (!businessId) return NextResponse.json({ error: "businessId is required." }, { status: 400 });
    await db.delete(organizationBusinesses).where(and(eq(organizationBusinesses.organizationId, organizationId), eq(organizationBusinesses.businessId, businessId)));
    await createAuditLog({ businessId, userId: access.session.user.id, action: "admin.organization.business_unlinked", resource: "organization", resourceId: organizationId, description: reason, metadata: { businessId } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unsupported administrative action." }, { status: 400 });
}
