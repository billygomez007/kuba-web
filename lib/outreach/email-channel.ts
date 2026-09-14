import { getResend } from "@/lib/email/resend";
import { createUnsubscribeToken } from "@/lib/outreach/unsubscribe-token";
import { createReplyToken, buildReplyToAddress } from "@/lib/email/reply-token";
import { getInboundDomain } from "@/lib/email/inbound-config";
import { conversationIdForCampaignRecipient } from "@/lib/email/inbound-correlation";

/**
 * Campaign email delivery. Reuses the existing centralized lazy
 * getResend() (lib/email/resend.ts) rather than constructing a second
 * Resend client, and the existing EMAIL_FROM env var (the one safe,
 * verified sending identity already used for auth/welcome/contact-sales
 * email) rather than inventing a new sender address.
 *
 * DEPLOYMENT REQUIREMENT (not yet satisfied): every campaign email sends
 * from the single platform-wide EMAIL_FROM address today. Per-business
 * verified sending domains/addresses are not implemented — this adapter's
 * `fromOverride` parameter exists so that capability can be added later
 * without changing every call site, but production campaign email should
 * not be considered fully ready until a real per-business (or at least
 * clearly-attributed) sender identity exists.
 */

const DEFAULT_GRAPH_TEMPLATE_VAR_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(DEFAULT_GRAPH_TEMPLATE_VAR_PATTERN, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
  });
}

export interface SendCampaignEmailParams {
  sendId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromOverride?: string;
  replyTo?: string;
}

export interface SendCampaignEmailResult {
  success: boolean;
  externalMessageId?: string;
  failureCode?: string;
  failureReason?: string;
}

/**
 * Sends one campaign email using a deterministic provider idempotency key
 * derived from the send row's own id — the SAME key on every retry of that
 * logical send, never a new key per attempt. This is what protects against
 * "provider accepted the send, then our process crashed before recording
 * success": a retry with the same idempotency key returns Resend's
 * already-accepted result instead of dispatching a second message.
 */
export async function sendCampaignEmail(params: SendCampaignEmailParams): Promise<SendCampaignEmailResult> {
  const from = params.fromOverride || process.env.EMAIL_FROM;
  if (!from) {
    return { success: false, failureCode: "invalid_template", failureReason: "EMAIL_FROM is not configured." };
  }

  try {
    const response = await getResend().emails.send(
      {
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(params.replyTo ? { replyTo: params.replyTo } : {}),
      },
      // Same idempotencyKey across every retry of this exact send row.
      { idempotencyKey: params.sendId },
    );

    if (response.error) {
      const retryable = isRetryableResendError(response.error.name);
      return {
        success: false,
        failureCode: retryable ? "provider_5xx" : "provider_rejected_permanent",
        failureReason: response.error.message || response.error.name,
      };
    }

    return { success: true, externalMessageId: response.data?.id };
  } catch (error) {
    return {
      success: false,
      failureCode: "network_error",
      failureReason: error instanceof Error ? error.message : "Unknown network error.",
    };
  }
}

function isRetryableResendError(errorName: string): boolean {
  const retryableNames = new Set([
    "rate_limit_exceeded",
    "internal_server_error",
    "application_error",
  ]);
  return retryableNames.has(errorName);
}

/**
 * Builds the signed Reply-To address for a campaign send, or undefined if
 * inbound email isn't configured (RESEND_INBOUND_DOMAIN unset) — never
 * advertise a reply address that goes nowhere. The conversation id is
 * deterministic from the recipient id (see conversationIdForCampaignRecipient),
 * so every sequence-step email to the same recipient carries a Reply-To
 * that resolves to the SAME conversation.
 */
export function buildCampaignReplyTo(params: {
  businessId: string;
  campaignId: string;
  recipientId: string;
  sendId: string;
}): string | undefined {
  const inboundDomain = getInboundDomain();
  if (!inboundDomain) return undefined;

  const token = createReplyToken({
    businessId: params.businessId,
    conversationId: conversationIdForCampaignRecipient(params.recipientId),
    campaignId: params.campaignId,
    recipientId: params.recipientId,
    sendId: params.sendId,
  });
  return buildReplyToAddress(token, inboundDomain);
}

/**
 * Appends a plain, non-guessable unsubscribe link to campaign email HTML.
 * Every automated outreach email must offer this (section 28) — callers
 * should not hand-roll their own unsubscribe footer.
 */
export function withUnsubscribeFooter(params: {
  html: string;
  businessId: string;
  recipientId: string;
  channel: "email";
  identity: string;
  unsubscribeBaseUrl: string;
}): string {
  const token = createUnsubscribeToken({
    businessId: params.businessId,
    recipientId: params.recipientId,
    channel: params.channel,
    identity: params.identity,
  });
  const unsubscribeUrl = `${params.unsubscribeBaseUrl}?token=${encodeURIComponent(token)}`;
  return `${params.html}\n<hr/>\n<p style="font-size:12px;color:#888;"><a href="${unsubscribeUrl}">Unsubscribe</a> from future emails.</p>`;
}
