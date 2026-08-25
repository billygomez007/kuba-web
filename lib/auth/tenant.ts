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

export async function getCurrentMembership() {
  const user =
    await getCurrentUser();

  if (!user) {
    return null;
  }

  const selectedBusinessId =
    (await cookies()).get("superkuba_business_id")?.value;

  const conditions = [
    eq(
      businessUsers.userId,
      user.id,
    ),
  ];

  if (selectedBusinessId) {
    conditions.push(
      eq(
        businessUsers.businessId,
        selectedBusinessId,
      ),
    );
  }

  const result =
    await db
      .select({
        id: businessUsers.id,
        businessId:
          businessUsers.businessId,
        userId:
          businessUsers.userId,
        role:
          businessUsers.role,
        permissions:
          businessUsers.permissions,
        branchId:
          businessUsers.branchId,
      })
      .from(businessUsers)
      .where(
        and(...conditions),
      )
      .limit(1);

  const memberships = await db
      .select({
        businessId: businessUsers.businessId,
        role: businessUsers.role,
        permissions: businessUsers.permissions,
        branchId: businessUsers.branchId,
      })
      .from(businessUsers)
      .where(eq(businessUsers.userId, user.id));

  return selectBusinessMembership(memberships, selectedBusinessId)
    ? result[0] ?? null
    : null;
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
