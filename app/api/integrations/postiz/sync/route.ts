import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { integrations } from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";
import {
  decryptPostizCredential,
  listPostizAccounts,
  POSTIZ_PROVIDER,
} from "@/lib/integrations/postiz/client";

export const runtime = "nodejs";

export async function POST() {
  const context = await requireBusinessMembership();

  if (!context.user || !context.membership) {
    return NextResponse.json(
      { error: context.error || "Business access denied." },
      { status: context.user ? 403 : 401 },
    );
  }

  const rows = await db
    .select({
      id: integrations.id,
      status: integrations.status,
      credentialsEncrypted:
        integrations.credentialsEncrypted,
    })
    .from(integrations)
    .where(
      and(
        eq(
          integrations.businessId,
          context.membership.businessId,
        ),
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
        error:
          "Postiz is not connected for the selected business.",
      },
      { status: 409 },
    );
  }

  try {
    const accessToken = decryptPostizCredential(
      integration.credentialsEncrypted,
    );

    const accounts = await listPostizAccounts(accessToken);

    /*
     * Do not persist these into marketing_social_accounts yet.
     * That native Marketing table is not on current production main.
     * This endpoint provides a safe provider-neutral bridge that the
     * Marketing release can consume later.
     */
    return NextResponse.json({
      provider: POSTIZ_PROVIDER,
      count: accounts.length,
      accounts: accounts.map((account) => ({
        id: account.id,
        provider: account.provider,
        name: account.name,
        handle: account.handle,
        picture: account.picture,
      })),
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
