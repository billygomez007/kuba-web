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
  exchangeDynamicsCode,
  getDynamicsIdentity,
  verifyDynamicsCrmAccess,
  verifyDynamicsState,
} from "@/lib/integrations/microsoft-dynamics/oauth";

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
      "dynamics",
      "cancelled",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  if (!code || !state) {
    destination.searchParams.set(
      "dynamics",
      "invalid_callback",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  try {
    const verified =
      verifyDynamicsState(
        state,
      );

    const tokens =
      await exchangeDynamicsCode(
        code,
        verified.environmentUrl,
      );

    const identity =
      await getDynamicsIdentity(
        verified.environmentUrl,
        tokens.access_token,
      );

    const readiness =
      await verifyDynamicsCrmAccess(
        verified.environmentUrl,
        tokens.access_token,
      );

    if (
      !readiness.accountsReady ||
      !readiness.contactsReady ||
      !readiness.opportunitiesReady
    ) {
      throw new Error(
        "Dynamics CRM entity access could not be verified.",
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
                "microsoft_dynamics",
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
            tokens.scope ||
            null,
          environmentUrl:
            verified.environmentUrl,
        }),
      );

    const metadata =
      JSON.stringify({
        environmentUrl:
          verified.environmentUrl,
        userId:
          identity.userId,
        organizationId:
          identity.organizationId,
        businessUnitId:
          identity.businessUnitId,
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
            identity.organizationId,
          displayName:
            "Microsoft Dynamics 365",
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
            "microsoft_dynamics",
          status:
            "active",
          externalAccountId:
            identity.organizationId,
          displayName:
            "Microsoft Dynamics 365",
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
      "dynamics",
      "connected",
    );

    return NextResponse.redirect(
      destination,
    );
  } catch (error) {
    console.error(
      "Dynamics OAuth callback failed:",
      error instanceof Error
        ? error.message
        : "unknown",
    );

    destination.searchParams.set(
      "dynamics",
      "failed",
    );

    return NextResponse.redirect(
      destination,
    );
  }
}
