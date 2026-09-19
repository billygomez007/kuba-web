import {
  NextResponse,
} from "next/server";
import {
  eq,
} from "drizzle-orm";

import { db } from "@/db";
import {
  integrations,
} from "@/db/schema";
import {
  getCurrentMembership,
} from "@/lib/auth/tenant";
import {
  integrationProviders,
  providerEnvironmentReady,
} from "@/lib/integrations/provider-registry";

export async function GET() {
  const membership =
    await getCurrentMembership();

  if (!membership) {
    return NextResponse.json(
      {
        error:
          "Business not found.",
      },
      { status: 404 },
    );
  }

  const existing =
    await db
      .select({
        id:
          integrations.id,
        provider:
          integrations.provider,
        status:
          integrations.status,
        displayName:
          integrations.displayName,
        externalAccountId:
          integrations.externalAccountId,
        lastWebhookAt:
          integrations.lastWebhookAt,
      })
      .from(integrations)
      .where(
        eq(
          integrations.businessId,
          membership.businessId,
        ),
      );

  return NextResponse.json({
    providers:
      integrationProviders.map(
        (provider) => {
          const integration =
            existing.find(
              (row) =>
                row.provider ===
                provider.id,
            );

          return {
            id:
              provider.id,
            name:
              provider.name,
            category:
              provider.category,
            connectionType:
              provider.connectionType,
            enabled:
              provider.enabled,
            environmentReady:
              providerEnvironmentReady(
                provider,
              ),
            connected:
              integration?.status ===
              "active",
            status:
              integration?.status ||
              "not_connected",
            displayName:
              integration?.displayName ||
              null,
            externalAccountId:
              integration?.externalAccountId ||
              null,
            lastWebhookAt:
              integration?.lastWebhookAt ||
              null,
          };
        },
      ),
  });
}
