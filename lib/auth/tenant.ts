import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businessUsers } from "@/db/schema";

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
        eq(
          businessUsers.userId,
          user.id,
        ),
      )
      .limit(1);

  return result[0] ?? null;
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

export function isSameBusiness(
  membershipBusinessId: string,
  resourceBusinessId: string,
) {
  return (
    membershipBusinessId ===
    resourceBusinessId
  );
}
