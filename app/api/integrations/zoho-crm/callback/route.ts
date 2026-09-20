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
  exchangeZohoCode,
  getZohoIdentity,
  verifyZohoCrmAccess,
  verifyZohoState,
} from "@/lib/integrations/zoho-crm/oauth";

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

  const accountsServer =
    request.nextUrl.searchParams.get(
      "accounts-server",
    );

  const location =
    request.nextUrl.searchParams.get(
      "location",
    );

  const destination =
    new URL(
      "/dashboard/integrations/crm",
      request.url,
    );

  if (providerError) {
    destination.searchParams.set(
      "zoho",
      "cancelled",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  if (!code || !state) {
    destination.searchParams.set(
      "zoho",
      "invalid_callback",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  try {
    const verified =
      verifyZohoState(
        state,
      );

    const tokens =
      await exchangeZohoCode(
        code,
        accountsServer,
      );

    const identity =
      await getZohoIdentity(
        tokens.apiDomain,
        tokens.accessToken,
      );

    const readiness =
      await verifyZohoCrmAccess(
        tokens.apiDomain,
        tokens.accessToken,
      );

    if (
      !readiness.leadsReady ||
      !readiness.contactsReady ||
      !readiness.accountsReady ||
      !readiness.dealsReady
    ) {
      throw new Error(
        "Zoho CRM access could not be verified.",
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
                "zoho_crm",
              ),
            ),
          )
          .limit(1)
      )[0];

    const credentials =
      encrypt(
        JSON.stringify({
          accessToken:
            tokens.accessToken,
          refreshToken:
            tokens.refreshToken,
          expiresAt:
            Date.now() +
            tokens.expiresIn *
              1000,
          tokenType:
            tokens.tokenType,
          apiDomain:
            tokens.apiDomain,
          accountsUrl:
            tokens.accountsUrl,
        }),
      );

    const metadata =
      JSON.stringify({
        userId:
          identity.id,
        userName:
          identity.name,
        userEmail:
          identity.email,
        timeZone:
          identity.timeZone,
        zuid:
          identity.zuid,
        location:
          location || null,
        apiDomain:
          tokens.apiDomain,
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
            identity.id,
          displayName:
            identity.name,
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
            "zoho_crm",
          status:
            "active",
          externalAccountId:
            identity.id,
          displayName:
            identity.name,
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
      "zoho",
      "connected",
    );

    return NextResponse.redirect(
      destination,
    );
  } catch (error) {
    console.error(
      "Zoho CRM OAuth callback failed:",
      error instanceof Error
        ? error.message
        : "unknown",
    );

    destination.searchParams.set(
      "zoho",
      "failed",
    );

    return NextResponse.redirect(
      destination,
    );
  }
}
