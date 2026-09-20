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
  createSalesforceState,
  salesforceAuthorizationUrl,
} from "@/lib/integrations/salesforce/oauth";

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
      createSalesforceState({
        businessId:
          membership.businessId,
        userId:
          session.user.id,
      });

    return NextResponse.redirect(
      salesforceAuthorizationUrl(
        state,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Salesforce is not configured.",
      },
      { status: 503 },
    );
  }
}
