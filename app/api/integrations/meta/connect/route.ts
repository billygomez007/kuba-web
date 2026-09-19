import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { getCurrentMembership } from "@/lib/auth/tenant";

const DEFAULT_GRAPH_VERSION = "v25.0";

export async function POST(request: Request) {
  const membership = await getCurrentMembership();

  if (!membership) {
    return NextResponse.json(
      { error: "Business not found." },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => null);
  const channel = body?.channel;

  if (
    channel !== "facebook_messenger" &&
    channel !== "instagram"
  ) {
    return NextResponse.json(
      { error: "Unsupported Meta channel." },
      { status: 400 },
    );
  }

  const appId = process.env.META_APP_ID;
  const redirectUri =
    process.env.META_OAUTH_REDIRECT_URI;

  if (!appId || !redirectUri) {
    return NextResponse.json(
      {
        error:
          "Meta OAuth is not configured for this environment.",
      },
      { status: 503 },
    );
  }

  const statePayload = {
    businessId: membership.businessId,
    channel,
    nonce: crypto.randomUUID(),
    issuedAt: Date.now(),
  };

  const state = Buffer.from(
    JSON.stringify(statePayload),
  ).toString("base64url");

  const scopes =
    process.env.META_OAUTH_SCOPES ||
    "pages_show_list,pages_messaging,pages_read_engagement,instagram_basic,instagram_manage_messages";

  const graphVersion =
    process.env.META_GRAPH_API_VERSION ||
    DEFAULT_GRAPH_VERSION;

  const url = new URL(
    `https://www.facebook.com/${graphVersion}/dialog/oauth`,
  );

  url.searchParams.set("client_id", appId);
  url.searchParams.set(
    "redirect_uri",
    redirectUri,
  );
  url.searchParams.set(
    "scope",
    scopes,
  );
  url.searchParams.set("state", state);

  return NextResponse.json({
    authorizationUrl: url.toString(),
  });
}
