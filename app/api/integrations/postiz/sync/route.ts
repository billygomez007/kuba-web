import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { integrations } from "@/db/schema";
import { createAuditLog } from "@/lib/auth/audit";
import { requirePostizAccess } from "@/lib/integrations/postiz/access";
import {
  getPostizAccessToken,
  listPostizIntegrations,
  POSTIZ_PROVIDER,
} from "@/lib/integrations/postiz/client";

export const dynamic = "force-dynamic";

export async function POST() {
  const access = await requirePostizAccess("manage");

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const rows = await db
    .select({
      id: integrations.id,
      status: integrations.status,
      credentialsEncrypted: integrations.credentialsEncrypted,
    })
    .from(integrations)
    .where(
      and(
        eq(integrations.businessId, access.membership.businessId),
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
    const token = getPostizAccessToken(integration.credentialsEncrypted);

    const accounts = await listPostizIntegrations(token);

    const normalized = accounts.map((account) => ({
      id:
        typeof account.id === "string"
          ? account.id
          : typeof account.identifier === "string"
            ? account.identifier
            : null,
      provider: typeof account.provider === "string" ? account.provider : null,
      name:
        typeof account.displayName === "string"
          ? account.displayName
          : typeof account.name === "string"
            ? account.name
            : null,
      handle: typeof account.handle === "string" ? account.handle : null,
      disabled: account.disabled === true,
    }));

    await createAuditLog({
      businessId: access.membership.businessId,
      userId: access.user.id,
      action: "integration.postiz.synced",
      resource: "integration",
      resourceId: integration.id,
      description: "Loaded connected social accounts from Postiz.",
      metadata: {
        provider: POSTIZ_PROVIDER,
        accountCount: normalized.length,
      },
    });

    return NextResponse.json({
      provider: POSTIZ_PROVIDER,
      connected: true,
      accounts: normalized,
    });
  } catch (error) {
    console.error("Postiz synchronization failed:", error);

    return NextResponse.json(
      {
        error: "Connected Postiz accounts could not be loaded.",
      },
      { status: 502 },
    );
  }
}
