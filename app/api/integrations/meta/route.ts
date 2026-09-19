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
      id: integrations.id,
      status: integrations.status,
      externalAccountId:
        integrations.externalAccountId,
      displayName: integrations.displayName,
      metadata: integrations.metadata,
      lastWebhookAt: integrations.lastWebhookAt,
      createdAt: integrations.createdAt,
    })
    .from(integrations)
    .where(
      and(
        eq(
          integrations.businessId,
          membership.businessId,
        ),
        eq(integrations.provider, "meta"),
      ),
    );

  return NextResponse.json({
    integrations: rows.map((row) => ({
      ...row,
      metadata: row.metadata
        ? JSON.parse(row.metadata)
        : null,
    })),
  });
}
