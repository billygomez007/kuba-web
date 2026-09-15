import { eq } from "drizzle-orm";

import { db } from "@/db";
import { organizations, organizationBusinesses } from "@/db/schema";
import { getOrganizationMembership, type OrganizationRole } from "@/lib/auth/organizations";
import { createAuditLog } from "@/lib/auth/audit";

// Only a portfolio owner/admin may fold a newly created business into their
// organization at creation time — a plain "member" can view the portfolio
// (getUserOrganizations/getCurrentUserOrganizations) but must not be able to
// expand it.
const ORGANIZATION_LINK_ROLES: ReadonlySet<OrganizationRole> = new Set(["owner", "admin"]);

export type AuthorizeOrganizationLinkResult =
  | { ok: true; organizationId: string; role: OrganizationRole }
  | { ok: false; status: number; error: string };

/**
 * Pure, request-independent authorization check for linking a brand-new
 * business into an organization at creation time. Deliberately takes a
 * plain userId rather than reading the session itself, so it is directly
 * testable (no next/headers dependency) and reusable from
 * app/api/businesses/additional/route.ts, which already has the
 * authenticated user from its own session lookup.
 */
export async function authorizeOrganizationLinkForUser(
  userId: string,
  organizationId: string,
): Promise<AuthorizeOrganizationLinkResult> {
  const organization = (
    await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).limit(1)
  )[0];
  if (!organization) return { ok: false, status: 404, error: "Organization not found." };

  const membership = await getOrganizationMembership(userId, organizationId);
  if (!membership) return { ok: false, status: 403, error: "Organization access denied." };
  if (!ORGANIZATION_LINK_ROLES.has(membership.role)) {
    return {
      ok: false,
      status: 403,
      error: "Only an organization owner or admin can link a new business.",
    };
  }

  return { ok: true, organizationId: organization.id, role: membership.role };
}

/**
 * Links an already-created business into an organization and audits the
 * action. Distinguished from the platform-admin "link_business" action
 * (app/api/admin/organizations/[id]/route.ts, action string
 * "admin.organization.business_linked") by its own action name, so the
 * audit trail can tell a self-serve link from an admin-forced one. Never
 * touches the business's subscription, employees, or businessUsers rows —
 * organization membership is additive grouping metadata only.
 */
export async function linkBusinessToOrganization(input: {
  businessId: string;
  organizationId: string;
  actorUserId: string;
  actorOrganizationRole: OrganizationRole;
}): Promise<void> {
  await db.insert(organizationBusinesses).values({
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    businessId: input.businessId,
    createdAt: new Date(),
  });

  await createAuditLog({
    businessId: input.businessId,
    userId: input.actorUserId,
    action: "organization.business_linked",
    resource: "organization",
    resourceId: input.organizationId,
    description: "Linked to organization during additional-business creation",
    metadata: { businessId: input.businessId, organizationRole: input.actorOrganizationRole },
  });
}
