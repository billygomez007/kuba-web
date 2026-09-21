import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { integrations } from "@/db/schema";
import { requirePostizAccess } from "@/lib/integrations/postiz/access";
import { POSTIZ_PROVIDER } from "@/lib/integrations/postiz/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requirePostizAccess("view");

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
      displayName: integrations.displayName,
      updatedAt: integrations.updatedAt,
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

  return NextResponse.json({
    provider: POSTIZ_PROVIDER,
    connected: integration?.status === "active",
    status: integration?.status ?? "not_connected",
    displayName: integration?.displayName ?? "Postiz",
    updatedAt: integration?.updatedAt ?? null,
  });
}
