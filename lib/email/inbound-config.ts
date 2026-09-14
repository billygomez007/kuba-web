/**
 * The one place inbound-email configuration is read from. Every value here
 * comes from an environment variable the account owner sets AFTER they
 * configure a receiving domain in their own Resend dashboard — nothing in
 * this file invents a domain, MX target, or DNS record value. See
 * docs/EMAIL_RUNTIME.md ("DNS requirements") for exactly what to configure
 * and where the real values come from.
 *
 * RESEND_INBOUND_DOMAIN is the sole readiness signal: its mere presence
 * means the owner has told us a receiving domain exists (they configured
 * it directly in Resend, including its real DNS records, which this
 * codebase never needs to know or reproduce — Resend validates its own
 * MX/DNS setup independently of this app). Its absence means inbound email
 * is not configured, and every dependent capability (business inbound
 * aliases, campaign reply-to addresses) must degrade honestly rather than
 * pretend to work against a domain that doesn't exist yet.
 */
export function getInboundDomain(): string | null {
  const domain = process.env.RESEND_INBOUND_DOMAIN?.trim();
  return domain ? domain.toLowerCase() : null;
}

export function isInboundEmailConfigured(): boolean {
  return getInboundDomain() !== null;
}

export function getInboundWebhookSecret(): string | null {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  return secret || null;
}

export type InboundReadiness =
  | { status: "NOT_CONFIGURED" }
  | { status: "READY"; domain: string };

/**
 * The single honest readiness check every route/UI surface should call
 * instead of re-deriving this logic. Both the domain AND the webhook
 * signing secret must be present — a domain with no way to verify webhook
 * authenticity is not safely "ready" (see Phase 13 of the audit this was
 * built for: never trust an unverified public POST).
 */
export function getInboundReadiness(): InboundReadiness {
  const domain = getInboundDomain();
  const secret = getInboundWebhookSecret();
  if (!domain || !secret) return { status: "NOT_CONFIGURED" };
  return { status: "READY", domain };
}

export type EmailIntegrationStatus = "NOT_CONFIGURED" | "CONFIGURED" | "ACTIVE" | "ERROR";

/**
 * The one place the Email Integration UI's status is computed — shared by
 * GET (read-only status) and PUT (post-activation status) in
 * app/api/integrations/email/route.ts, so the two can never disagree.
 * "ERROR" means a platform-level gap (sending itself isn't configured in
 * this environment), never something a single business can fix.
 */
export function classifyEmailIntegrationStatus(params: {
  sendingConfigured: boolean;
  hasIntegration: boolean;
  inboundReady: boolean;
}): EmailIntegrationStatus {
  if (!params.sendingConfigured) return "ERROR";
  if (!params.hasIntegration) return "NOT_CONFIGURED";
  if (!params.inboundReady) return "CONFIGURED";
  return "ACTIVE";
}
