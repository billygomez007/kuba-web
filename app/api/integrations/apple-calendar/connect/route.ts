import crypto from "crypto";

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
  encrypt,
} from "@/lib/encryption";
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
import {
  verifyCalDavConnection,
} from "@/lib/integrations/apple-calendar/caldav";

export async function POST(
  request: Request,
) {
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
      PERMISSIONS.INTEGRATIONS_MANAGE,
    )
  ) {
    return forbiddenResponse();
  }

  const body =
    await request
      .json()
      .catch(() => null);

  const serverUrl =
    typeof body?.serverUrl ===
    "string"
      ? body.serverUrl.trim()
      : "";

  const username =
    typeof body?.username ===
    "string"
      ? body.username.trim()
      : "";

  const password =
    typeof body?.password ===
    "string"
      ? body.password.trim()
      : "";

  if (
    !serverUrl ||
    !username ||
    !password
  ) {
    return NextResponse.json(
      {
        error:
          "Server URL, Apple ID/username, and app-specific password are required.",
      },
      { status: 400 },
    );
  }

  try {
    const verification =
      await verifyCalDavConnection({
        serverUrl,
        username,
        password,
      });

    const encrypted =
      encrypt(
        JSON.stringify({
          serverUrl:
            verification.serverUrl,
          username,
          password,
        }),
      );

    const metadata =
      JSON.stringify({
        serverUrl:
          verification.serverUrl,
        principalUrl:
          verification.principalUrl,
        calendarHomeUrl:
          verification.calendarHomeUrl,
        account:
          username,
        authType:
          "basic_app_password",
      });

    const existing =
      (
        await db
          .select({
            id:
              integrations.id,
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
                "apple_calendar",
              ),
            ),
          )
          .limit(1)
      )[0];

    const now =
      new Date();

    if (existing) {
      await db
        .update(
          integrations,
        )
        .set({
          status:
            "active",
          externalAccountId:
            username,
          displayName:
            "Apple Calendar",
          credentialsEncrypted:
            encrypted,
          metadata,
          updatedAt:
            now,
        })
        .where(
          and(
            eq(
              integrations.id,
              existing.id,
            ),
            eq(
              integrations.businessId,
              membership.businessId,
            ),
          ),
        );
    } else {
      await db
        .insert(
          integrations,
        )
        .values({
          id:
            crypto.randomUUID(),
          businessId:
            membership.businessId,
          provider:
            "apple_calendar",
          status:
            "active",
          externalAccountId:
            username,
          displayName:
            "Apple Calendar",
          credentialsEncrypted:
            encrypted,
          metadata,
          createdAt:
            now,
          updatedAt:
            now,
        });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      provider:
        "apple_calendar",
      account:
        username,
      calendarHomeReady:
        Boolean(
          verification.calendarHomeUrl,
        ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to connect Apple Calendar.",
      },
      { status: 400 },
    );
  }
}
