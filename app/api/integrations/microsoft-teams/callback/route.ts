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
  exchangeTeamsCode,
  getTeamsIdentity,
  listJoinedTeams,
  listTeamChannels,
  verifyTeamsState,
} from "@/lib/integrations/microsoft-teams/oauth";

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
      "teams",
      "cancelled",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  if (!code || !state) {
    destination.searchParams.set(
      "teams",
      "invalid_callback",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  try {
    const verified =
      verifyTeamsState(
        state,
      );

    const tokens =
      await exchangeTeamsCode(
        code,
      );

    const identity =
      await getTeamsIdentity(
        tokens.access_token,
      );

    const teams =
      await listJoinedTeams(
        tokens.access_token,
      );

    const teamsWithChannels =
      await Promise.all(
        teams.map(
          async (
            team: {
              id: string;
              displayName: string;
              description: string | null;
            },
          ) => ({
            ...team,
            channels:
              await listTeamChannels(
                tokens.access_token,
                team.id,
              ),
          }),
        ),
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
                "microsoft_teams",
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
        }),
      );

    const metadata =
      JSON.stringify({
        userId:
          identity.id,
        userName:
          identity.displayName,
        userEmail:
          identity.email,
        teams:
          teamsWithChannels,
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
            "microsoft_teams",
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
      "teams",
      "connected",
    );

    return NextResponse.redirect(
      destination,
    );
  } catch (error) {
    console.error(
      "Microsoft Teams OAuth callback failed:",
      error instanceof Error
        ? error.message
        : "unknown",
    );

    destination.searchParams.set(
      "teams",
      "failed",
    );

    return NextResponse.redirect(
      destination,
    );
  }
}
