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
  exchangeGoogleDriveCode,
  getGoogleDriveIdentity,
  listGoogleDriveFiles,
  verifyGoogleDriveState,
} from "@/lib/integrations/google-drive/oauth";

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
      "/dashboard/integrations/external-apps",
      request.url,
    );

  if (providerError) {
    destination.searchParams.set(
      "google-drive",
      "cancelled",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  if (!code || !state) {
    destination.searchParams.set(
      "google-drive",
      "invalid_callback",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  try {
    const verified =
      verifyGoogleDriveState(
        state,
      );

    const tokens =
      await exchangeGoogleDriveCode(
        code,
      );

    const identity =
      await getGoogleDriveIdentity(
        tokens.access_token,
      );

    const files =
      await listGoogleDriveFiles(
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
                "google_drive",
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
            tokens.scope ||
            null,
          tokenType:
            tokens.token_type ||
            "Bearer",
        }),
      );

    const metadata =
      JSON.stringify({
        accountName:
          identity.displayName,
        accountEmail:
          identity.email,
        permissionId:
          identity.permissionId,
        accessibleFileCount:
          files.length,
        recentFiles:
          files,
      });

    const now =
      new Date();

    const externalAccountId =
      identity.permissionId ||
      identity.email;

    if (existing) {
      await db
        .update(
          integrations,
        )
        .set({
          status:
            "active",
          externalAccountId,
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
            "google_drive",
          status:
            "active",
          externalAccountId,
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
      "google-drive",
      "connected",
    );

    return NextResponse.redirect(
      destination,
    );
  } catch (error) {
    console.error(
      "Google Drive OAuth callback failed:",
      error instanceof Error
        ? error.message
        : "unknown",
    );

    destination.searchParams.set(
      "google-drive",
      "failed",
    );

    return NextResponse.redirect(
      destination,
    );
  }
}
