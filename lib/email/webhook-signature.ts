import crypto from "crypto";

/**
 * Resend signs webhooks using Svix's standard webhook scheme (documented,
 * stable, provider-agnostic spec — the same scheme several other providers
 * use). Implemented manually with Node's built-in crypto, matching this
 * codebase's existing convention of not depending on a provider SDK for
 * webhook verification (see lib/channels/whatsapp.ts's verifyMetaSignature,
 * which does the same for Meta's HMAC scheme).
 *
 * Verifies:
 *  - the signature itself (HMAC-SHA256 over "<id>.<timestamp>.<rawBody>",
 *    using the base64-decoded secret after stripping its "whsec_" prefix)
 *  - the timestamp is within a bounded tolerance, so a captured, replayed
 *    webhook payload cannot be re-submitted indefinitely (Phase 13's
 *    "timestamp/replay protection where provider supports it" — Svix does)
 *
 * `svix-signature` can carry multiple space-separated "v1,<base64>" values
 * (secret rotation support) — any one matching is sufficient.
 */
const REPLAY_TOLERANCE_SECONDS = 5 * 60;

export interface WebhookHeaders {
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
}

export function verifyResendWebhookSignature(
  rawBody: string,
  headers: WebhookHeaders,
  secret: string | null | undefined,
): boolean {
  if (!secret) return false;
  const { svixId, svixTimestamp, svixSignature } = headers;
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const timestampSeconds = Number(svixTimestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (ageSeconds > REPLAY_TOLERANCE_SECONDS) return false;

  const secretKey = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let secretBuffer: Buffer;
  try {
    secretBuffer = Buffer.from(secretKey, "base64");
  } catch {
    return false;
  }
  if (secretBuffer.length === 0) return false;

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac("sha256", secretBuffer)
    .update(signedContent)
    .digest("base64");
  // Decoded to raw bytes, not the base64 string's own utf8 bytes — must
  // match candidateBuffer's encoding below or the length check (and thus
  // every signature) would fail unconditionally.
  const expectedBuffer = Buffer.from(expectedSignature, "base64");

  const candidates = svixSignature.split(" ").filter(Boolean);
  for (const candidate of candidates) {
    const [version, value] = candidate.split(",");
    if (version !== "v1" || !value) continue;
    let candidateBuffer: Buffer;
    try {
      candidateBuffer = Buffer.from(value, "base64");
    } catch {
      continue;
    }
    if (candidateBuffer.length !== expectedBuffer.length) continue;
    if (crypto.timingSafeEqual(candidateBuffer, expectedBuffer)) return true;
  }
  return false;
}
