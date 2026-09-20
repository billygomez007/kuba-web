import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { encrypt } from "@/lib/encryption";
import {
  exchangeGoogleCode,
  getGoogleCalendarIdentity,
  listGoogleCalendars,
  verifyGoogleState,
} from "@/lib/integrations/google-calendar/oauth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const providerError = request.nextUrl.searchParams.get("error");

  const destination = new URL(
    "/dashboard/integrations/calendar",
    request.url,
  );

  if (providerError) {
    destination.searchParams.set("google", "cancelled");
    return NextResponse.redirect(destination);
  }

  if (!code || !state) {
    destination.searchParams.set("google", "invalid_callback");
    return NextResponse.redirect(destination);
  }

  try {
    const verified = verifyGoogleState(state);
    const tokens = await exchangeGoogleCode(code);
    const identity = await getGoogleCalendarIdentity(tokens.access_token);
    const calendars = await listGoogleCalendars(tokens.access_token);

    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.businessId, verified.businessId),
        eq(integrations.provider, "google_calendar"),
      ),
    });

    const credentials = encrypt(JSON.stringify({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt: tokens.expires_in
        ? Date.now() + tokens.expires_in * 1000
        : null,
      scope: tokens.scope || null,
      tokenType: tokens.token_type || "Bearer",
    }));

    const metadata = JSON.stringify({
      primaryCalendarId: identity.id,
      primaryCalendarName: identity.summary,
      timeZone: identity.timeZone,
      calendars,
    });

    const now = new Date();

    if (existing) {
      await db
        .update(integrations)
        .set({
          status: "active",
          externalAccountId: identity.id,
          displayName: identity.summary,
          credentialsEncrypted: credentials,
          metadata,
          updatedAt: now,
        })
        .where(
          and(
            eq(integrations.id, existing.id),
            eq(integrations.businessId, verified.businessId),
          ),
        );
    } else {
      await db.insert(integrations).values({
        id: crypto.randomUUID(),
        businessId: verified.businessId,
        provider: "google_calendar",
        status: "active",
        externalAccountId: identity.id,
        displayName: identity.summary,
        credentialsEncrypted: credentials,
        metadata,
        createdAt: now,
        updatedAt: now,
      });
    }

    destination.searchParams.set("google", "connected");
    return NextResponse.redirect(destination);
  } catch (error) {
    console.error("Google Calendar OAuth callback failed:", error);
    destination.searchParams.set("google", "failed");
    return NextResponse.redirect(destination);
  }
}
