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
  exchangeSlackCode,
  listSlackChannels,
  verifySlackIdentity,
  verifySlackState,
} from "@/lib/integrations/slack/oauth";

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
      "slack",
      "cancelled",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  if (!code || !state) {
    destination.searchParams.set(
      "slack",
      "invalid_callback",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  try {
    const verified =
      verifySlackState(
        state,
      );

    const tokens =
      await exchangeSlackCode(
        code,
      );

    const identity =
      await verifySlackIdentity(
        tokens.accessToken,
      );

    if (
      identity.teamId &&
      identity.teamId !==
        tokens.teamId
    ) {
      throw new Error(
        "Slack workspace identity mismatch.",
      );
    }

    const channels =
      await listSlackChannels(
        tokens.accessToken,
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
                "slack",
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
          tokenType:
            tokens.tokenType,
          scope:
            tokens.scope,
        }),
      );

    const metadata =
      JSON.stringify({
        teamId:
          tokens.teamId,
        teamName:
          tokens.teamName,
        enterpriseId:
          tokens.enterpriseId,
        botUserId:
          tokens.botUserId,
        appId:
          tokens.appId,
        workspaceUrl:
          identity.url,
        channels:
          channels.map(
            (
              channel: {
                id: string;
                name: string;
                isPrivate: boolean;
                isMember: boolean;
              },
            ) => ({
              id:
                channel.id,
              name:
                channel.name,
              isPrivate:
                channel.isPrivate,
              isMember:
                channel.isMember,
            }),
          ),
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
            tokens.teamId,
          displayName:
            tokens.teamName,
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
            "slack",
          status:
            "active",
          externalAccountId:
            tokens.teamId,
          displayName:
            tokens.teamName,
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
      "slack",
      "connected",
    );

    return NextResponse.redirect(
      destination,
    );
  } catch (error) {
    console.error(
      "Slack OAuth callback failed:",
      error instanceof Error
        ? error.message
        : "unknown",
    );

    destination.searchParams.set(
      "slack",
      "failed",
    );

    return NextResponse.redirect(
      destination,
    );
  }
}
