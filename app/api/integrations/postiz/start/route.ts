import { NextResponse } from "next/server";

import { requireBusinessMembership } from "@/lib/auth/tenant";
import {
  buildPostizAuthorizationUrl,
  createPostizOAuthState,
} from "@/lib/integrations/postiz/client";

export const runtime = "nodejs";

export async function GET() {
  const context = await requireBusinessMembership();

  if (!context.user || !context.membership) {
    return NextResponse.json(
      { error: context.error || "Business access denied." },
      { status: context.user ? 403 : 401 },
    );
  }

  try {
    const state = createPostizOAuthState({
      businessId: context.membership.businessId,
      userId: context.user.id,
    });

    return NextResponse.redirect(
      buildPostizAuthorizationUrl(state),
    );
  } catch (error) {
    console.error("Postiz OAuth start failed:", error);

    return NextResponse.json(
      {
        error:
          "Postiz is not configured correctly for this SuperKuba environment.",
      },
      { status: 503 },
    );
  }
}
