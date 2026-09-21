import crypto from "node:crypto";

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { integrations } from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";
import {
  encryptPostizCredential,
  exchangePostizCode,
  POSTIZ_PROVIDER,
  verifyPostizOAuthState,
} from "@/lib/integrations/postiz/client";

export const runtime = "nodejs";

function redirectWithResult(
  request: NextRequest,
  result: "connected" | "error",
  reason?: string,
) {
  const url = new URL("/dashboard/integrations", request.url);

  url.searchParams.set("postiz", result);

  if (reason) {
    url.searchParams.set("reason", reason);
  }

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const context = await requireBusinessMembership();

  if (!context.user || !context.membership) {
    return redirectWithResult(request, "error", "unauthorized");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const providerError = request.nextUrl.searchParams.get("error");

  if (providerError) {
    return redirectWithResult(
      request,
      "error",
      "authorization_denied",
    );
  }

  if (!code || !state) {
    return redirectWithResult(
      request,
      "error",
      "missing_oauth_parameters",
    );
  }

  const statePayload = verifyPostizOAuthState(state);

  if (
    !statePayload ||
    statePayload.businessId !== context.membership.businessId ||
    statePayload.userId !== context.user.id
  ) {
    return redirectWithResult(
      request,
      "error",
      "invalid_oauth_state",
    );
  }

  try {
    const accessToken = await exchangePostizCode(code);
    const credentialsEncrypted =
      encryptPostizCredential(accessToken);

    const now = new Date();

    const existing = await db
      .select({
        id: integrations.id,
      })
      .from(integrations)
      .where(
        and(
          eq(
            integrations.businessId,
            context.membership.businessId,
          ),
          eq(integrations.provider, POSTIZ_PROVIDER),
        ),
      )
      .limit(1);

    const metadata = JSON.stringify({
      kind: "social_provider",
      provider: POSTIZ_PROVIDER,
      connectedByUserId: context.user.id,
    });

    if (existing[0]) {
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
            eq(integrations.id, existing[0].id),
            eq(
              integrations.businessId,
              context.membership.businessId,
            ),
          ),
        );
    } else {
      await db.insert(integrations).values({
        id: crypto.randomUUID(),
        businessId: context.membership.businessId,
        provider: POSTIZ_PROVIDER,
        status: "active",
        displayName: "Postiz",
        credentialsEncrypted,
        metadata,
        createdAt: now,
        updatedAt: now,
      });
    }

    return redirectWithResult(request, "connected");
  } catch (error) {
    console.error("Postiz OAuth callback failed:", error);

    return redirectWithResult(
      request,
      "error",
      "token_exchange_failed",
    );
  }
}
