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
  exchangeNotionCode,
  getNotionBotIdentity,
  searchNotionWorkspace,
  verifyNotionState,
} from "@/lib/integrations/notion/oauth";

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
      "notion",
      "cancelled",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  if (!code || !state) {
    destination.searchParams.set(
      "notion",
      "invalid_callback",
    );

    return NextResponse.redirect(
      destination,
    );
  }

  try {
    const verified =
      verifyNotionState(
        state,
      );

    const tokens =
      await exchangeNotionCode(
        code,
      );

    const identity =
      await getNotionBotIdentity(
        tokens.accessToken,
      );

    const content =
      await searchNotionWorkspace(
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
                "notion",
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
        }),
      );

    const metadata =
      JSON.stringify({
        workspaceId:
          tokens.workspaceId,
        workspaceName:
          tokens.workspaceName,
        workspaceIcon:
          tokens.workspaceIcon,
        botId:
          tokens.botId,
        integrationUserId:
          identity.id,
        integrationUserName:
          identity.name,
        duplicatedTemplateId:
          tokens.duplicatedTemplateId,
        accessibleContentCount:
          content.length,
        recentContent:
          content,
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
            tokens.workspaceId,
          displayName:
            tokens.workspaceName,
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
            "notion",
          status:
            "active",
          externalAccountId:
            tokens.workspaceId,
          displayName:
            tokens.workspaceName,
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
      "notion",
      "connected",
    );

    return NextResponse.redirect(
      destination,
    );
  } catch (error) {
    console.error(
      "Notion OAuth callback failed:",
      error instanceof Error
        ? error.message
        : "unknown",
    );

    destination.searchParams.set(
      "notion",
      "failed",
    );

    return NextResponse.redirect(
      destination,
    );
  }
}
