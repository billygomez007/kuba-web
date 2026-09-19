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
  normalizeZapierWebhookUrl,
  sendZapierWebhook,
} from "@/lib/integrations/zapier/webhook";

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

  const rawWebhookUrl =
    typeof body?.webhookUrl ===
    "string"
      ? body.webhookUrl
      : "";

  try {
    const webhookUrl =
      normalizeZapierWebhookUrl(
        rawWebhookUrl,
      );

    const verification =
      await sendZapierWebhook(
        webhookUrl,
        {
          type:
            "superkuba.integration.verify",
          source:
            "superkuba",
          businessId:
            membership.businessId,
          sentAt:
            new Date().toISOString(),
          message:
            "SuperKuba Zapier connection verified.",
        },
      );

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
                "zapier",
              ),
            ),
          )
          .limit(1)
      )[0];

    const credentials =
      encrypt(
        JSON.stringify({
          webhookUrl,
        }),
      );

    const metadata =
      JSON.stringify({
        verifiedAt:
          new Date().toISOString(),
        lastDeliveryStatus:
          verification.status,
        connectionType:
          "catch_hook",
      });

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
            "zapier-catch-hook",
          displayName:
            "Zapier",
          credentialsEncrypted:
            credentials,
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
            "zapier",
          status:
            "active",
          externalAccountId:
            "zapier-catch-hook",
          displayName:
            "Zapier",
          credentialsEncrypted:
            credentials,
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
        "zapier",
      deliveryVerified:
        true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to connect Zapier.",
      },
      {
        status: 400,
      },
    );
  }
}
