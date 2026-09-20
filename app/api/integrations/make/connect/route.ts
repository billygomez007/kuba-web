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
  normalizeMakeWebhookUrl,
  sendMakeWebhook,
} from "@/lib/integrations/make/webhook";

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

  const apiKey =
    typeof body?.apiKey ===
    "string"
      ? body.apiKey.trim()
      : "";

  try {
    const webhookUrl =
      normalizeMakeWebhookUrl(
        rawWebhookUrl,
      );

    const verification =
      await sendMakeWebhook(
        {
          webhookUrl,
          apiKey:
            apiKey || null,
        },
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
            "SuperKuba Make connection verified.",
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
                "make",
              ),
            ),
          )
          .limit(1)
      )[0];

    const credentials =
      encrypt(
        JSON.stringify({
          webhookUrl,
          apiKey:
            apiKey || null,
        }),
      );

    const metadata =
      JSON.stringify({
        verifiedAt:
          new Date().toISOString(),
        lastDeliveryStatus:
          verification.status,
        connectionType:
          "custom_webhook",
        apiKeyProtected:
          Boolean(apiKey),
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
            "make-custom-webhook",
          displayName:
            "Make",
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
            "make",
          status:
            "active",
          externalAccountId:
            "make-custom-webhook",
          displayName:
            "Make",
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
        "make",
      deliveryVerified:
        true,
      apiKeyProtected:
        Boolean(apiKey),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to connect Make.",
      },
      {
        status: 400,
      },
    );
  }
}
