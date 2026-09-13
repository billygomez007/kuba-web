import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { businessUsers } from "@/db/schema";

// All pure permission/role logic lives in permission-definitions.ts, which
// has no database import and is safe for a "use client" component to pull
// in (see that file's header comment for why this split exists — it fixes
// a live "This page couldn't load" crash on Team & Staff). Re-exported here
// so every existing server-side importer of "@/lib/auth/permissions" keeps
// working unchanged.
export * from "./permission-definitions";

import {
  hasPermission,
  type Permission,
} from "./permission-definitions";

export async function getBusinessMembership(
  userId: string,
  businessId?: string,
) {
  const conditions = [
    eq(
      businessUsers.userId,
      userId,
    ),
  ];

  if (businessId) {
    conditions.push(
      eq(
        businessUsers.businessId,
        businessId,
      ),
    );
  }

  const result = await db
    .select()
    .from(businessUsers)
    .where(and(...conditions));

  if (!businessId && result.length !== 1) {
    return null;
  }

  return result[0] || null;
}

export async function userHasPermission(
  userId: string,
  permission: Permission,
  businessId?: string,
) {
  const membership =
    await getBusinessMembership(
      userId,
      businessId,
    );

  if (!membership) {
    return false;
  }

  return hasPermission(
    membership.role,
    membership.permissions,
    permission,
  );
}

export type AuthorizedMembership = {
  id: string;
  businessId: string;
  userId: string;
  role: string;
  permissions: string | null;
  branchId: string | null;
};

export async function requirePermission(
  userId: string,
  permission: Permission,
  businessId?: string,
): Promise<AuthorizedMembership> {
  const membership =
    await getBusinessMembership(
      userId,
      businessId,
    );

  if (!membership) {
    throw new Error(
      "BUSINESS_ACCESS_DENIED",
    );
  }

  const allowed =
    hasPermission(
      membership.role,
      membership.permissions,
      permission,
    );

  if (!allowed) {
    throw new Error(
      "PERMISSION_DENIED",
    );
  }

  return membership as AuthorizedMembership;
}
