import {
  NextResponse,
} from "next/server";
import {
  headers,
} from "next/headers";

import { auth } from "@/lib/auth";
import {
  getCurrentMembership,
} from "@/lib/auth/tenant";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import {
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/security";
import {
  createHubSpotState,
  hubSpotAuthorizationUrl,
} from "@/lib/integrations/hubspot/oauth";

export async function GET() {
  const session =
    await auth.api.getSession({
      headers:
        await headers(),
    });

  if (!session?.user?.id) {
    return unauthorizedResponse();
  }

  const membership =
    await getCurrentMembership();

  if (!membership) {
    return forbiddenResponse();
  }

  if (
    !hasPermission(
      membership.role,
      membership.permissions,
      PERMISSIONS.INTEGRATIONS_MANAGE,
    )
  ) {
    return forbiddenResponse();
  }

  try {
    const state =
      createHubSpotState({
        businessId:
          membership.businessId,
        userId:
          session.user.id,
      });

    return NextResponse.redirect(
      hubSpotAuthorizationUrl(
        state,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "HubSpot is not configured.",
      },
      { status: 503 },
    );
  }
}
