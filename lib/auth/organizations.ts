import { eq } from "drizzle-orm";

import { db } from "@/db";
import { organizations, organizationMembers, organizationBusinesses, businesses } from "@/db/schema";

/*
 * Organization / portfolio layer. See db/schema.ts for the full rationale —
 * this is deliberately a THIRD, independent axis alongside users.platformRole
 * (platform-wide) and businessUsers.role (per-business). An organization
 * membership is grouping/oversight metadata: it authorizes portfolio-level
 * actions (viewing the portfolio dashboard, linking a business into the
 * portfolio) but NEVER substitutes for a businessUsers row. Operating inside
 * a specific business — reading its data, changing its settings, anything
 * lib/auth/tenant.ts's getCurrentMembership()/requireBusinessMembership()
 * gate — always requires that business's own explicit membership row,
 * regardless of organization role or platform role.
 */

export type OrganizationRole = "owner" | "admin" | "member";
const ORGANIZATION_ROLES: readonly OrganizationRole[] = ["owner", "admin", "member"];
export function isOrganizationRole(value: string): value is OrganizationRole {
  return (ORGANIZATION_ROLES as readonly string[]).includes(value);
}

export type OrganizationMembershipRow = {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  createdAt: Date;
};

// next/headers is request-scoped and cannot be resolved by plain module
// resolution outside a real HTTP request (breaks direct import in tests/
// scripts) — imported lazily here, only by the two functions that actually
// need the current request's session, so every other export in this file
// (the pure DB-query functions) stays importable and testable on its own.
async function getCurrentUser() {
  const { headers } = await import("next/headers");
  const { auth } = await import("@/lib/auth");
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

/** Plain query, no request-scoped dependency — usable directly in scripts, admin routes, and tests. */
export async function getOrganizationMembership(userId: string, organizationId: string): Promise<OrganizationMembershipRow | null> {
  const rows = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId));
  const match = rows.find((row) => row.organizationId === organizationId);
  return match ? { ...match, role: isOrganizationRole(match.role) ? match.role : "member" } : null;
}

/** Every organization the given user belongs to, with their role in each. Plain query — no session dependency. */
export async function getUserOrganizations(userId: string) {
  const rows = await db
    .select({
      organization: organizations,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, userId));
  return rows.map((row) => ({ ...row, role: isOrganizationRole(row.role) ? row.role : "member" as OrganizationRole }));
}

/** Request-scoped: every organization the CURRENTLY authenticated user belongs to. */
export async function getCurrentUserOrganizations() {
  const user = await getCurrentUser();
  if (!user) return [];
  return getUserOrganizations(user.id);
}

/**
 * Request-scoped gate for a specific portfolio's own surfaces (portfolio
 * dashboard, linking a business into it). Mirrors requireBusinessMembership's
 * shape so callers follow the same {user, membership, error} convention.
 */
export async function requireOrganizationAccess(organizationId: string) {
  const user = await getCurrentUser();
  if (!user) return { user: null, membership: null, error: "Unauthorized" } as const;
  const membership = await getOrganizationMembership(user.id, organizationId);
  if (!membership) return { user, membership: null, error: "Organization access denied." } as const;
  return { user, membership, error: null } as const;
}

/** Every business linked to a portfolio — grouping/discovery metadata only, never an access grant by itself. */
export async function getOrganizationBusinesses(organizationId: string) {
  return db
    .select({ business: businesses, linkedAt: organizationBusinesses.createdAt })
    .from(organizationBusinesses)
    .innerJoin(businesses, eq(organizationBusinesses.businessId, businesses.id))
    .where(eq(organizationBusinesses.organizationId, organizationId));
}

export async function getOrganizationForBusiness(businessId: string) {
  const rows = await db.select().from(organizationBusinesses).where(eq(organizationBusinesses.businessId, businessId)).limit(1);
  return rows[0] ?? null;
}
