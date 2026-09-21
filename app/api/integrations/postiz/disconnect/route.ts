import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { integrations } from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";
import { POSTIZ_PROVIDER } from "@/lib/integrations/postiz/client";

export const runtime = "nodejs";

export async function DELETE() {
  const context = await requireBusinessMembership();

  if (!context.user || !context.membership) {
    return NextResponse.json(
      { error: context.error || "Business access denied." },
      { status: context.user ? 403 : 401 },
    );
  }

  const existing = await db
    .select({
      id: integrations.id,
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

  if (!existing[0]) {
    return NextResponse.json({
      success: true,
      disconnected: false,
      alreadyDisconnected: true,
    });
  }

  await db
    .update(integrations)
    .set({
      status: "inactive",
      credentialsEncrypted: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(integrations.id, existing[0].id),
        eq(
          integrations.businessId,
          context.membership.businessId,
        ),
      ),
    );

  return NextResponse.json({
    success: true,
    disconnected: true,
  });
}
