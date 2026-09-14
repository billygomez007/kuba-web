import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businesses, integrations } from "@/db/schema";
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";
import {
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/security";
import { classifyEmailIntegrationStatus, getInboundReadiness, type EmailIntegrationStatus } from "@/lib/email/inbound-config";
import { createAuditLog } from "@/lib/auth/audit";

/**
 * Email integration status/activation. Honest about the real architecture
 * (Phase 18 of the email audit) — there is no per-business verified
 * sending domain yet (see docs/EMAIL_RUNTIME.md, "Per-business sender
 * identity"): every business's outbound mail uses the same platform-wide,
 * already-verified EMAIL_FROM address, which is not a secret (it appears
 * in the From header of every email SuperKuba sends) and is shown as-is
 * rather than pretending each business has its own. Inbound reachability
 * (a working alias) depends on whether the platform-wide receiving domain
 * has been configured at all (RESEND_INBOUND_DOMAIN) — never invented,
 * never claimed active before it genuinely is.
 */

function buildInboundAlias(businessSlug: string, domain: string): string {
  return `${businessSlug}@${domain}`;
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return unauthorizedResponse();

  const membership = await getCurrentMembership();
  if (!membership) return forbiddenResponse();

  if (!hasPermission(membership.role, membership.permissions, PERMISSIONS.INTEGRATIONS_VIEW)) {
    return forbiddenResponse();
  }

  const sendingConfigured = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  const readiness = getInboundReadiness();

  const result = await db
    .select({ id: integrations.id, status: integrations.status, externalAccountId: integrations.externalAccountId })
    .from(integrations)
    .where(and(eq(integrations.businessId, membership.businessId), eq(integrations.provider, "email")))
    .limit(1);
  const integration = result[0];

  const status: EmailIntegrationStatus = classifyEmailIntegrationStatus({
    sendingConfigured,
    hasIntegration: Boolean(integration),
    inboundReady: readiness.status === "READY",
  });

  return NextResponse.json({
    success: true,
    status,
    sending: {
      configured: sendingConfigured,
      from: sendingConfigured ? process.env.EMAIL_FROM : null,
    },
    inbound: {
      platformReady: readiness.status === "READY",
      domain: readiness.status === "READY" ? readiness.domain : null,
      alias: integration?.externalAccountId ?? null,
    },
  });
}

export async function PUT() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return unauthorizedResponse();

  const membership = await getCurrentMembership();
  if (!membership) return forbiddenResponse();

  if (!hasPermission(membership.role, membership.permissions, PERMISSIONS.INTEGRATIONS_MANAGE)) {
    return forbiddenResponse();
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return NextResponse.json(
      { error: "Email sending is not configured for this environment yet.", status: "ERROR" },
      { status: 409 },
    );
  }

  const businessRows = await db
    .select({ slug: businesses.slug })
    .from(businesses)
    .where(eq(businesses.id, membership.businessId))
    .limit(1);
  const business = businessRows[0];
  if (!business) return forbiddenResponse();

  const readiness = getInboundReadiness();
  const alias = readiness.status === "READY" ? buildInboundAlias(business.slug, readiness.domain) : null;

  const existing = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.businessId, membership.businessId), eq(integrations.provider, "email")))
    .limit(1);

  const now = new Date();
  const integrationId = existing[0]?.id || `email:${membership.businessId}`;

  if (existing[0]) {
    await db
      .update(integrations)
      .set({ status: "active", externalAccountId: alias, updatedAt: now })
      .where(eq(integrations.id, existing[0].id));
  } else {
    await db
      .insert(integrations)
      .values({
        id: integrationId,
        businessId: membership.businessId,
        provider: "email",
        status: "active",
        externalAccountId: alias,
        displayName: "Email",
        metadata: JSON.stringify({ source: "dashboard_activation" }),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: integrations.id });
  }

  await createAuditLog({
    businessId: membership.businessId,
    userId: session.user.id,
    action: "integration.email.activated",
    resource: "integration",
    resourceId: integrationId,
    description: "Activated the Email integration.",
    metadata: { inboundReady: readiness.status === "READY" },
  });

  return NextResponse.json({
    success: true,
    status: classifyEmailIntegrationStatus({ sendingConfigured: true, hasIntegration: true, inboundReady: readiness.status === "READY" }),
    inbound: { platformReady: readiness.status === "READY", alias },
  });
}
