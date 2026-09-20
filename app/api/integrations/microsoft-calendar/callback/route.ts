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
  exchangeMicrosoftCode,
  getMicrosoftIdentity,
  listMicrosoftCalendars,
  verifyMicrosoftState,
} from "@/lib/integrations/microsoft-calendar/oauth";

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
      "/dashboard/integrations/calendar",
      request.url,
    );

  if (providerError) {
    destination.searchParams.set(
      "microsoft",
      "cancelled",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  if (!code || !state) {
    destination.searchParams.set(
      "microsoft",
      "invalid_callback",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  try {
    const verified =
      verifyMicrosoftState(
        state,
      );

    const tokens =
      await exchangeMicrosoftCode(
        code,
      );

    const identity =
      await getMicrosoftIdentity(
        tokens.access_token,
      );

    const calendars =
      await listMicrosoftCalendars(
        tokens.access_token,
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
                verified.businessId,
              ),
              eq(
                integrations.provider,
                "microsoft_calendar",
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
          scope:
            tokens.scope || null,
          tokenType:
            tokens.token_type ||
            "Bearer",
        }),
      );

    const metadata =
      JSON.stringify({
        accountId:
          identity.id,
        accountEmail:
          identity.email,
        calendars,
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
            identity.displayName,
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
            "microsoft_calendar",
          status:
            "active",
          externalAccountId:
            identity.id,
          displayName:
            identity.displayName,
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
      "microsoft",
      "connected",
    );

    return NextResponse.redirect(
      destination,
    );
  } catch (error) {
    console.error(
      "Microsoft Calendar OAuth callback failed:",
      error instanceof Error
        ? error.message
        : "unknown",
    );

    destination.searchParams.set(
      "microsoft",
      "failed",
    );

    return NextResponse.redirect(
      destination,
    );
  }
}
