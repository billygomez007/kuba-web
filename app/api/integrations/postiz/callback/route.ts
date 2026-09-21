import crypto from "node:crypto";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { integrations } from "@/db/schema";
import { createAuditLog } from "@/lib/auth/audit";
import { encrypt } from "@/lib/encryption";
import { requirePostizAccess } from "@/lib/integrations/postiz/access";
import {
  exchangePostizAuthorizationCode,
  POSTIZ_PROVIDER,
} from "@/lib/integrations/postiz/client";
import { verifyPostizOAuthState } from "@/lib/integrations/postiz/oauth-state";

export const dynamic = "force-dynamic";

function dashboardRedirect(request: Request, params: Record<string, string>) {
  const url = new URL("/dashboard/integrations", request.url);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const access = await requirePostizAccess("manage");

  if (!access.ok) {
    return dashboardRedirect(request, {
      postiz: "error",
      reason: "access_denied",
    });
  }

  const url = new URL(request.url);
  const providerError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (providerError) {
    return dashboardRedirect(request, {
      postiz: "error",
      reason: "provider_denied",
    });
  }

  if (!code || !state) {
    return dashboardRedirect(request, {
      postiz: "error",
      reason: "invalid_callback",
    });
  }

  let statePayload;

  try {
    statePayload = verifyPostizOAuthState(state);
  } catch (error) {
    console.error("Postiz OAuth state verification failed:", error);

    return dashboardRedirect(request, {
      postiz: "error",
      reason: "invalid_state",
    });
  }

  if (
    !statePayload ||
    statePayload.businessId !== access.membership.businessId ||
    statePayload.userId !== access.user.id
  ) {
    return dashboardRedirect(request, {
      postiz: "error",
      reason: "invalid_state",
    });
  }

  try {
    const redirectUri = new URL(
      "/api/integrations/postiz/callback",
      request.url,
    ).toString();

    const token = await exchangePostizAuthorizationCode(code, redirectUri);

    const accessToken = token.access_token ?? token.accessToken;

    if (typeof accessToken !== "string" || !accessToken.trim()) {
      throw new Error("Postiz did not return an access token.");
    }

    const now = new Date();

    const existing = await db
      .select({
        id: integrations.id,
      })
      .from(integrations)
      .where(
        and(
          eq(integrations.businessId, access.membership.businessId),
          eq(integrations.provider, POSTIZ_PROVIDER),
        ),
      )
      .limit(1);

    const credentialsEncrypted = encrypt(JSON.stringify(token));

    const metadata = JSON.stringify({
      kind: "social_publishing_provider",
      provider: POSTIZ_PROVIDER,
      connectedVia: "oauth",
    });

    let integrationId: string;

    if (existing[0]) {
      integrationId = existing[0].id;

      await db
        .update(integrations)
        .set({
          status: "active",
          displayName: "Postiz",
          credentialsEncrypted,
          metadata,
          updatedAt: now,
        })
        .where(
          and(
            eq(integrations.id, integrationId),
            eq(integrations.businessId, access.membership.businessId),
          ),
        );
    } else {
      integrationId = crypto.randomUUID();

      await db.insert(integrations).values({
        id: integrationId,
        businessId: access.membership.businessId,
        provider: POSTIZ_PROVIDER,
        status: "active",
        displayName: "Postiz",
        credentialsEncrypted,
        metadata,
        createdAt: now,
        updatedAt: now,
      });
    }

    await createAuditLog({
      businessId: access.membership.businessId,
      userId: access.user.id,
      action: "integration.postiz.connected",
      resource: "integration",
      resourceId: integrationId,
      description: "Connected Postiz social publishing provider.",
      metadata: {
        provider: POSTIZ_PROVIDER,
      },
    });

    return dashboardRedirect(request, {
      postiz: "connected",
    });
  } catch (error) {
    console.error("Postiz OAuth callback failed:", error);

    return dashboardRedirect(request, {
      postiz: "error",
      reason: "token_exchange_failed",
    });
  }
}
