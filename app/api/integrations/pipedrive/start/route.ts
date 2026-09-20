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
  createPipedriveState,
  pipedriveAuthorizationUrl,
} from "@/lib/integrations/pipedrive/oauth";

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
      createPipedriveState({
        businessId:
          membership.businessId,
        userId:
          session.user.id,
      });

    return NextResponse.redirect(
      pipedriveAuthorizationUrl(
        state,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Pipedrive is not configured.",
      },
      { status: 503 },
    );
  }
}
