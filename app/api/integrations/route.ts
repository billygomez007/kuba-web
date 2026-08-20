import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import {
  getBusinessMembership,
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import {
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/security";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return unauthorizedResponse();
  }

  const membership =
    await getBusinessMembership(
      session.user.id,
    );

  if (!membership) {
    return forbiddenResponse();
  }

  const allowed =
    hasPermission(
      membership.role,
      membership.permissions,
      PERMISSIONS.INTEGRATIONS_VIEW,
    );

  if (!allowed) {
    return forbiddenResponse();
  }

  const result = await db
    .select()
    .from(integrations)
    .where(
      eq(
        integrations.businessId,
        membership.businessId,
      ),
    );

  return NextResponse.json({
    integrations: result,
  });
}
