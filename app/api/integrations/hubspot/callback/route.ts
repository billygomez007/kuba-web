import crypto from "crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  and,
  eq,
} from "drizzle-orm";

import { db } from "@/db";
import {
  integrations,
} from "@/db/schema";
import {
  encrypt,
} from "@/lib/encryption";
import {
  exchangeHubSpotCode,
  getHubSpotAccount,
  verifyHubSpotCrmAccess,
  verifyHubSpotState,
} from "@/lib/integrations/hubspot/oauth";

export async function GET(
  request: NextRequest,
) {
  const code =
    request.nextUrl.searchParams.get(
      "code",
    );

  const state =
    request.nextUrl.searchParams.get(
      "state",
    );

  const providerError =
    request.nextUrl.searchParams.get(
      "error",
    );

  const destination =
    new URL(
      "/dashboard/integrations/crm",
      request.url,
    );

  if (providerError) {
    destination.searchParams.set(
      "hubspot",
      "cancelled",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  if (!code || !state) {
    destination.searchParams.set(
      "hubspot",
      "invalid_callback",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  try {
    const verified =
      verifyHubSpotState(
        state,
      );

    const tokens =
      await exchangeHubSpotCode(
        code,
      );

    const account =
      await getHubSpotAccount(
        tokens.access_token,
      );

    const readiness =
      await verifyHubSpotCrmAccess(
        tokens.access_token,
      );

    if (
      !readiness.contactsReady ||
      !readiness.companiesReady ||
      !readiness.dealsReady
    ) {
      throw new Error(
        "HubSpot CRM permissions could not be verified.",
      );
    }

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
                verified.businessId,
              ),
              eq(
                integrations.provider,
                "hubspot",
              ),
            ),
          )
          .limit(1)
      )[0];

    const credentials =
      encrypt(
        JSON.stringify({
          accessToken:
            tokens.access_token,
          refreshToken:
            tokens.refresh_token ||
            null,
          expiresAt:
            tokens.expires_in
              ? Date.now() +
                tokens.expires_in *
                  1000
              : null,
          tokenType:
            tokens.token_type ||
            "Bearer",
        }),
      );

    const metadata =
      JSON.stringify({
        hubId:
          account.hubId,
        user:
          account.user,
        scopes:
          account.scopes,
        readiness,
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
            account.hubId,
          displayName:
            account.user ||
            (account.hubId
              ? `HubSpot ${account.hubId}`
              : "HubSpot"),
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
              verified.businessId,
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
            verified.businessId,
          provider:
            "hubspot",
          status:
            "active",
          externalAccountId:
            account.hubId,
          displayName:
            account.user ||
            (account.hubId
              ? `HubSpot ${account.hubId}`
              : "HubSpot"),
          credentialsEncrypted:
            credentials,
          metadata,
          createdAt:
            now,
          updatedAt:
            now,
        });
    }

    destination.searchParams.set(
      "hubspot",
      "connected",
    );

    return NextResponse.redirect(
      destination,
    );
  } catch (error) {
    console.error(
      "HubSpot OAuth callback failed:",
      error instanceof Error
        ? error.message
        : "unknown",
    );

    destination.searchParams.set(
      "hubspot",
      "failed",
    );

    return NextResponse.redirect(
      destination,
    );
  }
}
