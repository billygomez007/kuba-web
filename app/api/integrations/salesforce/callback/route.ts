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
  exchangeSalesforceCode,
  getSalesforceIdentity,
  verifySalesforceCrmAccess,
  verifySalesforceState,
} from "@/lib/integrations/salesforce/oauth";

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
      "salesforce",
      "cancelled",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  if (!code || !state) {
    destination.searchParams.set(
      "salesforce",
      "invalid_callback",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  try {
    const verified =
      verifySalesforceState(
        state,
      );

    const tokens =
      await exchangeSalesforceCode(
        code,
      );

    const identity =
      await getSalesforceIdentity(
        tokens.instance_url,
        tokens.access_token,
      );

    const readiness =
      await verifySalesforceCrmAccess(
        tokens.instance_url,
        tokens.access_token,
        identity.version,
      );

    if (
      !readiness.contactsReady ||
      !readiness.accountsReady ||
      !readiness.opportunitiesReady
    ) {
      throw new Error(
        "Salesforce CRM access could not be verified.",
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
                "salesforce",
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
          instanceUrl:
            tokens.instance_url,
          tokenType:
            tokens.token_type ||
            "Bearer",
        }),
      );

    const metadata =
      JSON.stringify({
        accountId:
          identity.id,
        accountName:
          identity.name,
        accountEmail:
          identity.email,
        organizationId:
          identity.organizationId,
        apiVersion:
          identity.version,
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
            identity.organizationId ||
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
            "salesforce",
          status:
            "active",
          externalAccountId:
            identity.organizationId ||
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
      "salesforce",
      "connected",
    );

    return NextResponse.redirect(
      destination,
    );
  } catch (error) {
    console.error(
      "Salesforce OAuth callback failed:",
      error instanceof Error
        ? error.message
        : "unknown",
    );

    destination.searchParams.set(
      "salesforce",
      "failed",
    );

    return NextResponse.redirect(
      destination,
    );
  }
}
