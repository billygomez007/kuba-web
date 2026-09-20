import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { integrations } from "@/db/schema";
import { getCurrentMembership } from "@/lib/auth/tenant";
import {
  decryptPaystackSecret,
  verifyPaystackTransactionAccess,
} from "@/lib/integrations/paystack-merchant/client";

export async function POST() {
  const membership = await getCurrentMembership();

  if (!membership) {
    return NextResponse.json(
      { error: "Business not found." },
      { status: 404 },
    );
  }

  const rows = await db
    .select({
      credentialsEncrypted: integrations.credentialsEncrypted,
    })
    .from(integrations)
    .where(
      and(
        eq(integrations.businessId, membership.businessId),
        eq(integrations.provider, "paystack_merchant"),
        eq(integrations.status, "active"),
      ),
    )
    .limit(1);

  if (!rows[0]?.credentialsEncrypted) {
    return NextResponse.json(
      { error: "Paystack is not connected." },
      { status: 404 },
    );
  }

  try {
    const secretKey = decryptPaystackSecret(
      rows[0].credentialsEncrypted,
    );

    await verifyPaystackTransactionAccess(secretKey);

    return NextResponse.json({
      ok: true,
      provider: "paystack_merchant",
    });
  } catch {
    return NextResponse.json(
      { error: "Paystack connection verification failed." },
      { status: 502 },
    );
  }
}
