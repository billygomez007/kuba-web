import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  integrations,
} from "@/db/schema";
import {
  getBusinessMembership,
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import {
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/security";

export async function POST(
  request: Request,
) {
  const session =
    await auth.api.getSession({
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
      PERMISSIONS.INTEGRATIONS_MANAGE,
    );

  if (!allowed) {
    return forbiddenResponse();
  }

  const { email } =
    await request.json();

  if (
    typeof email !== "string" ||
    !email.trim()
  ) {
    return NextResponse.json(
      {
        error: "Email required",
      },
      {
        status: 400,
      },
    );
  }

  const normalizedEmail =
    email.trim().toLowerCase();

  await db.insert(integrations).values({
    id: crypto.randomUUID(),

    businessId:
      membership.businessId,

    provider: "email",

    status: "active",

    displayName:
      normalizedEmail,

    externalAccountId:
      normalizedEmail,

    metadata: JSON.stringify({
      email: normalizedEmail,
    }),

    createdAt: new Date(),

    updatedAt: new Date(),
  });

  return NextResponse.json({
    success: true,
  });
}
