import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { integrations } from "@/db/schema";
import { createAuditLog } from "@/lib/auth/audit";
import { requirePostizAccess } from "@/lib/integrations/postiz/access";
import { POSTIZ_PROVIDER } from "@/lib/integrations/postiz/client";

export const dynamic = "force-dynamic";

export async function DELETE() {
  const access = await requirePostizAccess("manage");

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const existing = await db
    .select({
      id: integrations.id,
    })
    .from(integrations)
    .where(
      and(
        eq(integrations.businessId, access.membership.businessId),
        eq(integrations.provider, POSTIZ_PROVIDER),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    return NextResponse.json({
      success: true,
      disconnected: false,
      status: "not_connected",
    });
  }

  await db
    .update(integrations)
    .set({
      status: "disconnected",
      credentialsEncrypted: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(integrations.id, existing[0].id),
        eq(integrations.businessId, access.membership.businessId),
      ),
    );

  await createAuditLog({
    businessId: access.membership.businessId,
    userId: access.user.id,
    action: "integration.postiz.disconnected",
    resource: "integration",
    resourceId: existing[0].id,
    description: "Disconnected Postiz social publishing provider.",
    metadata: {
      provider: POSTIZ_PROVIDER,
    },
  });

  return NextResponse.json({
    success: true,
    disconnected: true,
    status: "disconnected",
  });
}
