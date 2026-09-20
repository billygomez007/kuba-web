import {
  NextRequest,
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
  createDynamicsState,
  dynamicsAuthorizationUrl,
  normalizeDynamicsEnvironmentUrl,
} from "@/lib/integrations/microsoft-dynamics/oauth";

export async function GET(
  request: NextRequest,
) {
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

  const raw =
    request.nextUrl.searchParams.get(
      "environmentUrl",
    );

  if (!raw) {
    return NextResponse.json(
      {
        error:
          "Dynamics environment URL is required.",
      },
      { status: 400 },
    );
  }

  try {
    const environmentUrl =
      normalizeDynamicsEnvironmentUrl(
        raw,
      );

    const state =
      createDynamicsState({
        businessId:
          membership.businessId,
        userId:
          session.user.id,
        environmentUrl,
      });

    return NextResponse.redirect(
      dynamicsAuthorizationUrl(
        state,
        environmentUrl,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Dynamics 365 is not configured.",
      },
      { status: 400 },
    );
  }
}
