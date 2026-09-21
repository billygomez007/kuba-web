import crypto from "node:crypto";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  integrations,
  marketingSocialAccounts,
} from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";
import {
  decryptPostizCredential,
  listPostizAccounts,
  POSTIZ_PROVIDER,
} from "@/lib/integrations/postiz/client";

export const runtime = "nodejs";

function normalizeMarketingProvider(provider: string): string | null {
  const value = provider.trim().toLowerCase();

  if (value.includes("facebook")) {
    return "facebook";
  }

  if (value.includes("instagram")) {
    return "instagram";
  }

  if (value.includes("linkedin")) {
    return "linkedin";
  }

  if (value === "x" || value.includes("twitter")) {
    return "x";
  }

  if (value.includes("tiktok")) {
    return "tiktok";
  }

  if (value.includes("youtube")) {
    return "youtube";
  }

  if (value.includes("telegram")) {
    return "telegram";
  }

  return null;
}

export async function POST() {
  const context = await requireBusinessMembership();

  if (!context.user || !context.membership) {
    return NextResponse.json(
      { error: context.error || "Business access denied." },
      { status: context.user ? 403 : 401 },
    );
  }

  const businessId = context.membership.businessId;

  const rows = await db
    .select({
      id: integrations.id,
      status: integrations.status,
      credentialsEncrypted: integrations.credentialsEncrypted,
    })
    .from(integrations)
    .where(
      and(
        eq(integrations.businessId, businessId),
        eq(integrations.provider, POSTIZ_PROVIDER),
      ),
    )
    .limit(1);

  const integration = rows[0];

  if (
    !integration ||
    integration.status !== "active" ||
    !integration.credentialsEncrypted
  ) {
    return NextResponse.json(
      {
        error: "Postiz is not connected for the selected business.",
      },
      { status: 409 },
    );
  }

  try {
    const accessToken = decryptPostizCredential(
      integration.credentialsEncrypted,
    );

    const accounts = await listPostizAccounts(accessToken);
    const now = new Date();

    const persistedAccounts: Array<{
      id: string;
      provider: string;
      displayName: string;
      handle: string | null;
    }> = [];

    for (const account of accounts) {
      const provider = normalizeMarketingProvider(account.provider);

      if (!provider) {
        continue;
      }

      const externalAccountId = account.id;
      const displayName =
        account.name ||
        account.handle ||
        `${provider.charAt(0).toUpperCase()}${provider.slice(1)} account`;

      const existing = await db
        .select({
          id: marketingSocialAccounts.id,
        })
        .from(marketingSocialAccounts)
        .where(
          and(
            eq(marketingSocialAccounts.businessId, businessId),
            eq(marketingSocialAccounts.provider, provider),
            eq(
              marketingSocialAccounts.externalAccountId,
              externalAccountId,
            ),
          ),
        )
        .limit(1);

      const metadata = JSON.stringify({
        source: "postiz",
        postizAccountId: account.id,
        postizProvider: account.provider,
        picture: account.picture,
      });

      if (existing[0]) {
        await db
          .update(marketingSocialAccounts)
          .set({
            displayName,
            handle: account.handle,
            accountType: "postiz",
            status: "connected",
            metadata,
            connectedAt: now,
            expiresAt: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(marketingSocialAccounts.id, existing[0].id),
              eq(marketingSocialAccounts.businessId, businessId),
            ),
          );

        persistedAccounts.push({
          id: existing[0].id,
          provider,
          displayName,
          handle: account.handle,
        });
      } else {
        const id = crypto.randomUUID();

        await db.insert(marketingSocialAccounts).values({
          id,
          businessId,
          provider,
          externalAccountId,
          displayName,
          handle: account.handle,
          accountType: "postiz",
          status: "connected",
          metadata,
          connectedAt: now,
          expiresAt: null,
          createdAt: now,
          updatedAt: now,
        });

        persistedAccounts.push({
          id,
          provider,
          displayName,
          handle: account.handle,
        });
      }
    }

    return NextResponse.json({
      provider: POSTIZ_PROVIDER,
      count: accounts.length,
      marketingAccountCount: persistedAccounts.length,
      accounts: accounts.map((account) => ({
        id: account.id,
        provider: account.provider,
        name: account.name,
        handle: account.handle,
        picture: account.picture,
      })),
      marketingAccounts: persistedAccounts,
    });
  } catch (error) {
    console.error("Postiz account sync failed:", error);

    return NextResponse.json(
      {
        error:
          "SuperKuba could not retrieve the connected social accounts from Postiz.",
      },
      { status: 502 },
    );
  }
}
