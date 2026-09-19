import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { integrations } from "@/db/schema";

import {
  getMetaAccessToken,
} from "./integration";

function graphVersion() {
  return (
    process.env.META_GRAPH_API_VERSION ||
    "v25.0"
  );
}

export async function sendMetaMessage(params: {
  businessId: string;
  integrationId: string;
  recipient: string;
  message: string;
  provider:
    | "facebook"
    | "instagram";
}) {
  const integration =
    (
      await db
        .select()
        .from(integrations)
        .where(
          and(
            eq(
              integrations.id,
              params.integrationId,
            ),
            eq(
              integrations.businessId,
              params.businessId,
            ),
            eq(
              integrations.provider,
              params.provider,
            ),
            eq(
              integrations.status,
              "active",
            ),
          ),
        )
        .limit(1)
    )[0];

  if (!integration) {
    return {
      success: false,
      error:
        "integration_not_active",
    };
  }

  const token =
    getMetaAccessToken(
      integration,
    );

  if (
    !token ||
    !integration.externalAccountId
  ) {
    return {
      success: false,
      error:
        "integration_not_configured",
    };
  }

  const url =
    new URL(
      `https://graph.facebook.com/${graphVersion()}/${integration.externalAccountId}/messages`,
    );

  url.searchParams.set(
    "access_token",
    token,
  );

  const response =
    await fetch(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify({
            recipient: {
              id:
                params.recipient,
            },
            message: {
              text:
                params.message,
            },
          }),
      },
    );

  const result =
    await response
      .json()
      .catch(() => null);

  if (!response.ok) {
    console.error(
      "Meta message send rejected.",
      {
        provider:
          params.provider,
        status:
          response.status,
      },
    );

    return {
      success: false,
      error:
        "provider_rejected",
    };
  }

  const messageId =
    result?.message_id ||
    result?.messageId ||
    result?.id;

  if (!messageId) {
    return {
      success: false,
      error:
        "no_message_id",
    };
  }

  return {
    success: true,
    externalMessageId:
      String(messageId),
  };
}
