import {
  NextResponse,
} from "next/server";
import {
  headers,
} from "next/headers";
import {
  and,
  eq,
} from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  integrations,
} from "@/db/schema";
import {
  getCurrentMembership,
} from "@/lib/auth/tenant";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import {
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/security";

export async function GET() {
  const session =
    await auth.api.getSession({
      headers:
        await headers(),
    });

  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  const membership =
    await getCurrentMembership();

  if (!membership) {
    return forbiddenResponse();
  }

  if (
    !hasPermission(
      membership.role,
      membership.permissions,
      PERMISSIONS.INTEGRATIONS_VIEW,
    )
  ) {
    return forbiddenResponse();
  }

  const integration =
    (
      await db
        .select({
          status:
            integrations.status,
          displayName:
            integrations.displayName,
          externalAccountId:
            integrations.externalAccountId,
          metadata:
            integrations.metadata,
          updatedAt:
            integrations.updatedAt,
        })
        .from(integrations)
        .where(
          and(
            eq(
              integrations.businessId,
              membership.businessId,
            ),
            eq(
              integrations.provider,
              "notion",
            ),
          ),
        )
        .limit(1)
    )[0];

  if (!integration) {
    return NextResponse.json({
      connected: false,
      provider:
        "notion",
    });
  }

  let metadata = null;

  try {
    metadata =
      integration.metadata
        ? JSON.parse(
            integration.metadata,
          )
        : null;
  } catch {
    metadata = null;
  }

  return NextResponse.json({
    connected:
      integration.status ===
      "active",
    provider:
      "notion",
    displayName:
      integration.displayName,
    workspaceId:
      integration.externalAccountId,
    accessibleContentCount:
      metadata?.accessibleContentCount ??
      0,
    recentContent:
      Array.isArray(
        metadata?.recentContent,
      )
        ? metadata.recentContent
        : [],
    updatedAt:
      integration.updatedAt,
  });
}
