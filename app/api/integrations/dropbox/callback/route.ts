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
  exchangeDropboxCode,
  getDropboxIdentity,
  listDropboxFiles,
  verifyDropboxState,
} from "@/lib/integrations/dropbox/oauth";

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
      "dropbox",
      "cancelled",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  if (!code || !state) {
    destination.searchParams.set(
      "dropbox",
      "invalid_callback",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  try {
    const verified =
      verifyDropboxState(
        state,
      );

    const tokens =
      await exchangeDropboxCode(
        code,
      );

    const identity =
      await getDropboxIdentity(
        tokens.accessToken,
      );

    const files =
      await listDropboxFiles(
        tokens.accessToken,
      );

    if (
      identity.accountId !==
      tokens.accountId
    ) {
      throw new Error(
        "Dropbox account identity mismatch.",
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
                "dropbox",
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
            tokens.expiresIn
              ? Date.now() +
                tokens.expiresIn *
                  1000
              : null,
          tokenType:
            tokens.tokenType,
          scope:
            tokens.scope,
        }),
      );

    const metadata =
      JSON.stringify({
        accountId:
          identity.accountId,
        accountName:
          identity.displayName,
        accountEmail:
          identity.email,
        emailVerified:
          identity.emailVerified,
        accountType:
          identity.accountType,
        profilePhotoUrl:
          identity.profilePhotoUrl,
        accessibleEntryCount:
          files.length,
        recentEntries:
          files,
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
            identity.accountId,
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
            "dropbox",
          status:
            "active",
          externalAccountId:
            identity.accountId,
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
      "dropbox",
      "connected",
    );

    return NextResponse.redirect(
      destination,
    );
  } catch (error) {
    console.error(
      "Dropbox OAuth callback failed:",
      error instanceof Error
        ? error.message
        : "unknown",
    );

    destination.searchParams.set(
      "dropbox",
      "failed",
    );

    return NextResponse.redirect(
      destination,
    );
  }
}
