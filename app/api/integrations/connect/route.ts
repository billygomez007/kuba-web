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
    provider.id === "google_calendar"
  ) {
    return NextResponse.json({
      mode: "oauth",
      redirectUrl:
        "/api/integrations/google-calendar/start",
    });
  }

  if (
    provider.id === "microsoft_calendar"
  ) {
    return NextResponse.json({
      mode: "oauth",
      redirectUrl:
        "/api/integrations/microsoft-calendar/start",
    });
  }

  if (
    provider.id === "apple_calendar"
  ) {
    return NextResponse.json({
      mode: "credentials",
      redirectUrl:
        "/dashboard/integrations/apple-calendar",
    });
  }

  if (
    provider.id === "hubspot"
  ) {
    return NextResponse.json({
      mode: "oauth",
      redirectUrl:
        "/api/integrations/hubspot/start",
    });
  }

  if (
    provider.id === "salesforce"
  ) {
    return NextResponse.json({
      mode: "oauth",
      redirectUrl:
        "/api/integrations/salesforce/start",
    });
  }

  if (
    provider.id === "pipedrive"
  ) {
    return NextResponse.json({
      mode: "oauth",
      redirectUrl:
        "/api/integrations/pipedrive/start",
    });
  }

  if (
    provider.id === "zoho_crm"
  ) {
    return NextResponse.json({
      mode: "oauth",
      redirectUrl:
        "/api/integrations/zoho-crm/start",
    });
  }

  if (
    provider.id === "microsoft_dynamics"
  ) {
    return NextResponse.json({
      mode: "setup",
      redirectUrl:
        "/dashboard/integrations/microsoft-dynamics",
    });
  }

  if (
    provider.id === "slack"
  ) {
    return NextResponse.json({
      mode: "oauth",
      redirectUrl:
        "/api/integrations/slack/start",
    });
  }

  if (
    provider.id === "microsoft_teams"
  ) {
    return NextResponse.json({
      mode: "oauth",
      redirectUrl:
        "/api/integrations/microsoft-teams/start",
    });
  }

  if (
    provider.id === "notion"
  ) {
    return NextResponse.json({
      mode: "oauth",
      redirectUrl:
        "/api/integrations/notion/start",
    });
  }

  if (
    provider.id === "google_drive"
  ) {
    return NextResponse.json({
      mode: "oauth",
      redirectUrl:
        "/api/integrations/google-drive/start",
    });
  }

  if (
    provider.id === "dropbox"
  ) {
    return NextResponse.json({
      mode: "oauth",
      redirectUrl:
        "/api/integrations/dropbox/start",
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
