import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { integrations } from "@/db/schema";
import { getCurrentMembership } from "@/lib/auth/tenant";

export async function GET() {
  const membership = await getCurrentMembership();

  if (!membership) {
    return NextResponse.json(
      { error: "Business not found." },
      { status: 404 },
    );
  }

  const rows = await db
    .select({
      status: integrations.status,
      displayName: integrations.displayName,
      externalAccountId: integrations.externalAccountId,
      lastWebhookAt: integrations.lastWebhookAt,
    })
    .from(integrations)
    .where(
      and(
        eq(integrations.businessId, membership.businessId),
        eq(integrations.provider, "paystack_merchant"),
      ),
    )
    .limit(1);

  const integration = rows[0];

  return NextResponse.json({
    connected: integration?.status === "active",
    status: integration?.status || "not_connected",
    displayName: integration?.displayName || null,
    externalAccountId: integration?.externalAccountId || null,
    lastWebhookAt: integration?.lastWebhookAt || null,
  });
}
