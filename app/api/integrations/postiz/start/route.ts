import { NextResponse } from "next/server";

import { requirePostizAccess } from "@/lib/integrations/postiz/access";
import { getPostizConfig } from "@/lib/integrations/postiz/client";
import { createPostizOAuthState } from "@/lib/integrations/postiz/oauth-state";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requirePostizAccess("manage");

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  try {
    const config = getPostizConfig();
    const state = createPostizOAuthState(
      access.membership.businessId,
      access.user.id,
    );

    const redirectUri = new URL(
      "/api/integrations/postiz/callback",
      request.url,
    ).toString();

    const authorizeUrl = new URL("/oauth/authorize", config.baseUrl);
    authorizeUrl.searchParams.set("client_id", config.clientId);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("state", state);

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    console.error("Postiz OAuth start failed:", error);

    return NextResponse.json(
      { error: "Postiz connection could not be started." },
      { status: 500 },
    );
  }
}
