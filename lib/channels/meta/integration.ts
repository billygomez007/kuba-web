import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { integrations } from "@/db/schema";
import { decrypt } from "@/lib/encryption";

import type {
  MetaChannel,
  MetaIntegrationMetadata,
} from "./types";

export function parseMetaMetadata(
  metadata: string | null,
): MetaIntegrationMetadata | null {
  if (!metadata) return null;

  try {
    const parsed = JSON.parse(metadata);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    const channel = (parsed as {
      channel?: unknown;
    }).channel;

    if (
      channel !== "facebook_messenger" &&
      channel !== "instagram"
    ) {
      return null;
    }

    return parsed as MetaIntegrationMetadata;
  } catch {
    return null;
  }
}

export async function resolveMetaIntegrationByExternalAccount(
  channel: MetaChannel,
  externalAccountId: string,
) {
  const rows = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.provider, "meta"),
        eq(integrations.status, "active"),
        eq(
          integrations.externalAccountId,
          externalAccountId,
        ),
      ),
    );

  return (
    rows.find((row) => {
      const metadata = parseMetaMetadata(row.metadata);
      return metadata?.channel === channel;
    }) || null
  );
}

export function getMetaAccessToken(
  integration: {
    credentialsEncrypted: string | null;
  },
) {
  if (!integration.credentialsEncrypted) {
    return null;
  }

  return decrypt(integration.credentialsEncrypted);
}
