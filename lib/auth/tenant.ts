import { cookies, headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { branches, businessUsers } from "@/db/schema";
import { isResourceOwnedByBusiness, selectBusinessMembership } from "@/lib/auth/business-context-policy";

export async function getCurrentUser() {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (!session?.user) {
    return null;
  }

  return session.user;
}

/**
 * The full business-context resolution result — distinguishes the THREE
 * genuinely different reasons getCurrentMembership() can come back empty,
 * which a raw `null` cannot: no membership at all (route to onboarding),
 * an unresolved choice among several real memberships (route to a business
 * selector), or a resolved single membership (proceed). Callers that only
 * need the existing null-or-membership shape should keep using
 * getCurrentMembership(); this is for callers (like /api/auth/me and
 * /api/command-center/overview) that need to tell an authenticated user
 * with no workspace yet apart from a genuine authorization failure,
 * instead of returning the same ambiguous "no membership" outcome for both.
 */
export type BusinessMembershipRow = {
  id: string;
  businessId: string;
  userId: string;
  role: string;
  permissions: string | null;
  branchId: string | null;
};

export type BusinessMembershipStatus =
  | { status: "unauthenticated" }
  | { status: "no_membership" }
  | { status: "ambiguous"; membershipCount: number }
  | { status: "resolved"; membership: BusinessMembershipRow };

export async function getBusinessMembershipStatus(): Promise<BusinessMembershipStatus> {
  const user = await getCurrentUser();

  if (!user) {
    return { status: "unauthenticated" };
  }

  const selectedBusinessId =
    (await cookies()).get("superkuba_business_id")?.value;

  // A single query, scoped only by userId — never by the (possibly stale/
  // invalid/foreign) selectedBusinessId. Selection among these rows is
  // decided entirely by selectBusinessMembership, so there is exactly one
  // policy for "which business," not two queries that could disagree with
  // each other about it.
  const memberships = await db
    .select({
      id: businessUsers.id,
      businessId: businessUsers.businessId,
      userId: businessUsers.userId,
      role: businessUsers.role,
      permissions: businessUsers.permissions,
      branchId: businessUsers.branchId,
    })
    .from(businessUsers)
    .where(eq(businessUsers.userId, user.id));

  if (memberships.length === 0) {
    return { status: "no_membership" };
  }

  const selected = selectBusinessMembership(memberships, selectedBusinessId);

  if (!selected) {
    return { status: "ambiguous", membershipCount: memberships.length };
  }

  return { status: "resolved", membership: selected };
}

export async function getCurrentMembership() {
  const result = await getBusinessMembershipStatus();
  return result.status === "resolved" ? result.membership : null;
}

export async function requireBusinessMembership() {
  const user =
    await getCurrentUser();

  if (!user) {
    return {
      user: null,
      membership: null,
      error: "Unauthorized",
    } as const;
  }

  const membership =
    await getCurrentMembership();

  if (!membership) {
    return {
      user,
      membership: null,
      error: "Business access denied.",
    } as const;
  }

  return {
    user,
    membership,
    error: null,
  } as const;
}

export async function getBranchForBusiness(
  branchId: string,
  businessId: string,
) {
  const result = await db
    .select()
    .from(branches)
    .where(
      and(
        eq(branches.id, branchId),
        eq(branches.businessId, businessId),
      ),
    )
    .limit(1);

  return result[0] ?? null;
}

export function isSameBusiness(
  membershipBusinessId: string,
  resourceBusinessId: string,
) {
  return isResourceOwnedByBusiness(membershipBusinessId, resourceBusinessId);
}
