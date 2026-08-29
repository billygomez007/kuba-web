import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import {
  getBusinessMembership,
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import {
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/security";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";

// List of all available integration providers
const ALL_PROVIDERS = [
  "whatsapp",
  "email",
  "website",
  "sms",
  "voice",
  "meta",
  "telegram",
  "calendar",
  "stripe",
  "paystack",
  "quickbooks",
  "xero",
  "hubspot",
  "salesforce",
  "slack",
  "teams",
];

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return unauthorizedResponse();
  }

  const membership =
    await getBusinessMembership(
      session.user.id,
    );

  if (!membership) {
    return forbiddenResponse();
  }

  const allowed =
    hasPermission(
      membership.role,
      membership.permissions,
      PERMISSIONS.INTEGRATIONS_VIEW,
    );

  if (!allowed) {
    return forbiddenResponse();
  }

  const entitlements = await getBusinessEntitlements(membership.businessId);
  if (!hasCapability(entitlements, "integrations.core")) {
    return NextResponse.json({ error: "Integrations require a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "growth" }, { status: 403 });
  }

  // This response is returned directly to the client, so only safe,
  // non-secret columns may be selected here — never the encrypted
  // credential column.
  const result = await db
    .select({
      id: integrations.id,
      businessId: integrations.businessId,
      provider: integrations.provider,
      status: integrations.status,
      externalAccountId: integrations.externalAccountId,
      externalPhoneNumberId: integrations.externalPhoneNumberId,
      displayName: integrations.displayName,
      metadata: integrations.metadata,
      lastWebhookAt: integrations.lastWebhookAt,
      createdAt: integrations.createdAt,
      updatedAt: integrations.updatedAt,
    })
    .from(integrations)
    .where(
      eq(
        integrations.businessId,
        membership.businessId,
      ),
    );

  // Calculate stats
  const connected = result.filter(
    (i) => i.status === "active",
  ).length;
  const total = ALL_PROVIDERS.length;

  return NextResponse.json({
    integrations: result,
    stats: {
      connected,
      total,
      lastUpdated: new Date().toISOString(),
    },
  });
}
