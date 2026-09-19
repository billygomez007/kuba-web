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
  decrypt,
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
  sendZapierWebhook,
} from "@/lib/integrations/zapier/webhook";

export async function POST() {
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

  const integration =
    (
      await db
        .select({
          id:
            integrations.id,
          status:
            integrations.status,
          credentialsEncrypted:
            integrations.credentialsEncrypted,
          metadata:
            integrations.metadata,
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

  if (
    !integration ||
    integration.status !==
      "active" ||
    !integration.credentialsEncrypted
  ) {
    return NextResponse.json(
      {
        error:
          "Zapier is not connected.",
      },
      {
        status: 409,
      },
    );
  }

  try {
    const credentials =
      JSON.parse(
        decrypt(
          integration.credentialsEncrypted,
        ),
      ) as {
        webhookUrl?: string;
      };

    if (!credentials.webhookUrl) {
      throw new Error(
        "Zapier webhook configuration is missing.",
      );
    }

    const delivery =
      await sendZapierWebhook(
        credentials.webhookUrl,
        {
          type:
            "superkuba.integration.test",
          source:
            "superkuba",
          businessId:
            membership.businessId,
          sentAt:
            new Date().toISOString(),
          message:
            "Your SuperKuba → Zapier integration is working.",
        },
      );

    let metadata:
      Record<
        string,
        unknown
      > = {};

    try {
      metadata =
        integration.metadata
          ? JSON.parse(
              integration.metadata,
            )
          : {};
    } catch {
      metadata = {};
    }

    await db
      .update(
        integrations,
      )
      .set({
        metadata:
          JSON.stringify({
            ...metadata,
            lastTestAt:
              new Date().toISOString(),
            lastDeliveryStatus:
              delivery.status,
          }),
        updatedAt:
          new Date(),
      })
      .where(
        and(
          eq(
            integrations.id,
            integration.id,
          ),
          eq(
            integrations.businessId,
            membership.businessId,
          ),
        ),
      );

    return NextResponse.json({
      success: true,
      delivered: true,
      status:
        delivery.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Zapier test delivery failed.",
      },
      {
        status: 502,
      },
    );
  }
}
