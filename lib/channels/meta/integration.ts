import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  businesses,
  integrations,
} from "@/db/schema";
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

    const channel =
      (parsed as {
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

function providerForChannel(
  channel: MetaChannel,
) {
  return channel === "facebook_messenger"
    ? "facebook"
    : "instagram";
}

export async function resolveMetaIntegrationByExternalAccount(
  channel: MetaChannel,
  externalAccountId: string,
) {
  const rows = await db
    .select({
      integration: integrations,
      business: businesses,
    })
    .from(integrations)
    .innerJoin(
      businesses,
      eq(
        integrations.businessId,
        businesses.id,
      ),
    )
    .where(
      and(
        eq(
          integrations.provider,
          providerForChannel(channel),
        ),
        eq(
          integrations.externalAccountId,
          externalAccountId,
        ),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export function getMetaAccessToken(
  integration: {
    credentialsEncrypted: string | null;
  },
) {
  if (!integration.credentialsEncrypted) {
    return null;
  }

  return decrypt(
    integration.credentialsEncrypted,
  );
}
