import {
  NextResponse,
} from "next/server";

import {
  getCurrentMembership,
} from "@/lib/auth/tenant";
import {
  getIntegrationProvider,
  providerEnvironmentReady,
} from "@/lib/integrations/provider-registry";

export async function POST(
  request: Request,
) {
  const membership =
    await getCurrentMembership();

  if (!membership) {
    return NextResponse.json(
      {
        error:
          "Business not found.",
      },
      { status: 404 },
    );
  }

  const body =
    await request
      .json()
      .catch(() => null);

  const providerId =
    typeof body?.provider ===
    "string"
      ? body.provider.trim()
      : "";

  const provider =
    getIntegrationProvider(
      providerId,
    );

  if (
    !provider ||
    !provider.enabled
  ) {
    return NextResponse.json(
      {
        error:
          "Unsupported integration provider.",
      },
      { status: 400 },
    );
  }

  if (
    provider.connectionType ===
    "platform"
  ) {
    const route =
      provider.id === "voice"
        ? "/dashboard/integrations/voice"
        : "/dashboard/integrations/developer";

    return NextResponse.json({
      mode: "internal",
      redirectUrl: route,
    });
  }

  if (
    provider.connectionType ===
      "oauth" &&
    !providerEnvironmentReady(
      provider,
    )
  ) {
    return NextResponse.json(
      {
        error:
          `${provider.name} is available, but its provider credentials have not been configured for this SuperKuba environment.`,
        code:
          "PROVIDER_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  /*
   * Provider-specific OAuth URL generation,
   * API-key forms and bot-token forms are
   * implemented in dedicated routes.
   *
   * This endpoint deliberately does not mark
   * anything active merely because a user
   * clicked Connect.
   */
  return NextResponse.json({
    mode:
      provider.connectionType,
    provider:
      provider.id,
    businessId:
      membership.businessId,
    next:
      `/dashboard/integrations/connect/${provider.id}`,
  });
}
