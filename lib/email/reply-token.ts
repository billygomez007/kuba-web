import crypto from "crypto";

/**
 * Signed, stateless reply-address token — the primary tenant/thread
 * identification mechanism for inbound email (see docs/EMAIL_RUNTIME.md,
 * "Business-safe addressing"). Same HMAC-SHA256 + timingSafeEqual pattern
 * as lib/outreach/unsubscribe-token.ts (reused deliberately, not
 * reinvented), signed with the existing BETTER_AUTH_SECRET rather than a
 * new dedicated secret.
 *
 * Embedded in the Reply-To header of every outbound SuperKuba email as
 * `reply+<token>@<inbound-domain>`. When a reply arrives, the inbound
 * webhook decodes and verifies the token from the recipient address it was
 * actually sent to — never from the email body, subject, or sender
 * address, none of which are server-verifiable. A verified token
 * deterministically resolves businessId + conversationId, and, for
 * campaign-originated email, campaignId/recipientId/sendId as well.
 */
export interface ReplyTokenPayload {
  businessId: string;
  conversationId: string;
  campaignId?: string;
  recipientId?: string;
  sendId?: string;
}

function getSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required to sign reply tokens.");
  return secret;
}

function encodePayload(payload: ReplyTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function sign(encodedPayload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");
}

export function createReplyToken(payload: ReplyTokenPayload): string {
  const encoded = encodePayload(payload);
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Returns the payload only if the signature is valid; otherwise null. Never
 * throws on malformed input — an inbound email's recipient address is
 * attacker-controlled input (anyone can email any address), so this must
 * fail closed and quietly, exactly like verifyUnsubscribeToken.
 */
export function verifyReplyToken(token: string): ReplyTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== providedBuffer.length) return null;
  if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (
      typeof payload?.businessId !== "string" ||
      typeof payload?.conversationId !== "string"
    ) {
      return null;
    }
    return {
      businessId: payload.businessId,
      conversationId: payload.conversationId,
      campaignId: typeof payload.campaignId === "string" ? payload.campaignId : undefined,
      recipientId: typeof payload.recipientId === "string" ? payload.recipientId : undefined,
      sendId: typeof payload.sendId === "string" ? payload.sendId : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Builds the full Reply-To mailbox for a given token, e.g.
 * "reply+<token>@reply.example.com". The inbound domain is deliberately a
 * required parameter, not a hardcoded default — see
 * lib/email/inbound-config.ts, which is the one place this reads from
 * configuration (never invented here).
 */
export function buildReplyToAddress(token: string, inboundDomain: string): string {
  return `reply+${token}@${inboundDomain}`;
}

/**
 * Extracts a reply token from a recipient address's local part, if it
 * matches the "reply+<token>" convention this codebase generates. Returns
 * null (not a throw) for any address that doesn't match — most inbound
 * mail will not be a reply-token address (see the per-business alias path
 * in lib/email/inbound-correlation.ts for the other addressing mechanism).
 */
export function extractReplyToken(recipientAddress: string): string | null {
  const trimmed = recipientAddress.trim();
  const atIndex = trimmed.indexOf("@");
  const localPart = atIndex >= 0 ? trimmed.slice(0, atIndex) : trimmed;
  // Only the "reply+" marker is matched case-insensitively (a relay could
  // plausibly normalize it); the token itself must keep its exact original
  // case, since it is base64url (case-significant) and signed as such —
  // lowercasing it here would corrupt every token before verification ever
  // runs.
  if (!localPart.toLowerCase().startsWith("reply+")) return null;
  const token = localPart.slice("reply+".length);
  return token || null;
}
