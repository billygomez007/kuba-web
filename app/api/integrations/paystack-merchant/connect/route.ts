import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { integrations } from "@/db/schema";
import { getCurrentMembership } from "@/lib/auth/tenant";
import {
  encryptPaystackSecret,
  verifyPaystackMerchant,
  verifyPaystackTransactionAccess,
} from "@/lib/integrations/paystack-merchant/client";

export async function POST(request: NextRequest) {
  const membership = await getCurrentMembership();

  if (!membership) {
    return NextResponse.json(
      { error: "Business not found." },
      { status: 404 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { secretKey?: string; displayName?: string }
    | null;

  const secretKey = body?.secretKey?.trim();

  if (!secretKey) {
    return NextResponse.json(
      { error: "Paystack secret key is required." },
      { status: 400 },
    );
  }

  try {
    const identity = await verifyPaystackMerchant(secretKey);
    await verifyPaystackTransactionAccess(secretKey);

    const encrypted = encryptPaystackSecret(secretKey);

    const existing = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.businessId, membership.businessId),
          eq(integrations.provider, "paystack_merchant"),
        ),
      )
      .limit(1);

    const values = {
      businessId: membership.businessId,
      provider: "paystack_merchant",
      status: "active",
      displayName:
        body?.displayName?.trim() ||
        identity.businessName ||
        "Paystack",
      externalAccountId: String(identity.id),
      credentialsEncrypted: encrypted,
      metadata: JSON.stringify({
        email: identity.email,
        currency: identity.currency,
      }),
      updatedAt: new Date(),
    } as typeof integrations.$inferInsert;

    if (existing[0]) {
      await db
        .update(integrations)
        .set(values)
        .where(
          and(
            eq(integrations.id, existing[0].id),
            eq(integrations.businessId, membership.businessId),
          ),
        );
    } else {
      await db.insert(integrations).values(values);
    }

    return NextResponse.json({
      connected: true,
      provider: "paystack_merchant",
      displayName: values.displayName,
      externalAccountId: values.externalAccountId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to verify Paystack account.",
      },
      { status: 400 },
    );
  }
}
