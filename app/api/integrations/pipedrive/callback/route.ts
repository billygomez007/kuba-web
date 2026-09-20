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
  exchangePipedriveCode,
  getPipedriveIdentity,
  verifyPipedriveCrmAccess,
  verifyPipedriveState,
} from "@/lib/integrations/pipedrive/oauth";

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
      "pipedrive",
      "cancelled",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  if (!code || !state) {
    destination.searchParams.set(
      "pipedrive",
      "invalid_callback",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  try {
    const verified =
      verifyPipedriveState(
        state,
      );

    const tokens =
      await exchangePipedriveCode(
        code,
      );

    const identity =
      await getPipedriveIdentity(
        tokens.api_domain,
        tokens.access_token,
      );

    const readiness =
      await verifyPipedriveCrmAccess(
        tokens.api_domain,
        tokens.access_token,
      );

    if (
      !readiness.personsReady ||
      !readiness.organizationsReady ||
      !readiness.dealsReady
    ) {
      throw new Error(
        "Pipedrive CRM access could not be verified.",
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
                "pipedrive",
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
          scope:
            tokens.scope || null,
          apiDomain:
            tokens.api_domain,
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
        companyId:
          identity.companyId,
        companyName:
          identity.companyName,
        apiDomain:
          tokens.api_domain,
        readiness,
      });

    const now =
      new Date();

    const externalAccountId =
      identity.companyId ||
      identity.id;

    const displayName =
      identity.companyName ||
      identity.name ||
      "Pipedrive";

    if (existing) {
      await db
        .update(
          integrations,
        )
        .set({
          status:
            "active",
          externalAccountId,
          displayName,
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
            "pipedrive",
          status:
            "active",
          externalAccountId,
          displayName,
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
      "pipedrive",
      "connected",
    );

    return NextResponse.redirect(
      destination,
    );
  } catch (error) {
    console.error(
      "Pipedrive OAuth callback failed:",
      error instanceof Error
        ? error.message
        : "unknown",
    );

    destination.searchParams.set(
      "pipedrive",
      "failed",
    );

    return NextResponse.redirect(
      destination,
    );
  }
}
