import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { integrations } from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";
import { POSTIZ_PROVIDER } from "@/lib/integrations/postiz/client";

export const runtime = "nodejs";

export async function GET() {
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
      displayName: integrations.displayName,
      updatedAt: integrations.updatedAt,
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

  return NextResponse.json({
    provider: POSTIZ_PROVIDER,
    connected:
      integration?.status === "active",
    status:
      integration?.status || "not_connected",
    displayName:
      integration?.displayName || "Postiz",
    updatedAt:
      integration?.updatedAt || null,
  });
}
