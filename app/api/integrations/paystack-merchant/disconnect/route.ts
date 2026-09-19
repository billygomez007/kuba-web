import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { integrations } from "@/db/schema";
import { getCurrentMembership } from "@/lib/auth/tenant";

export async function POST() {
  const membership = await getCurrentMembership();

  if (!membership) {
    return NextResponse.json(
      { error: "Business not found." },
      { status: 404 },
    );
  }

  await db
    .delete(integrations)
    .where(
      and(
        eq(integrations.businessId, membership.businessId),
        eq(integrations.provider, "paystack_merchant"),
      ),
    );

  return NextResponse.json({ disconnected: true });
}
