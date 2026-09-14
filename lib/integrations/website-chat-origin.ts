// Validate the serialized authority before URL can repair malformed input.
// Browser hosts are ASCII (IDNs use punycode); IPv6 addresses are bracketed.
const SERIALIZED_HTTPS_ORIGIN =
  /^https:\/\/([a-z0-9._-]+|\[[0-9a-f:.]+\])(?::(0|[1-9][0-9]{0,4}))?$/i;

/**
 * `null` means the integration predates origin enforcement and remains on the
 * documented compatibility path. An empty array is intentionally strict and
 * denies every browser origin until an administrator configures one.
 */
export function parseAllowedOrigins(
  serialized: string | null | undefined,
): string[] | null {
  if (serialized == null || serialized.trim() === "") return null;

  try {
    const value: unknown = JSON.parse(serialized);
    if (!Array.isArray(value)) return [];

    const normalized = value.map((item) =>
      typeof item === "string" ? normalizeOrigin(item) : null,
    );

    return normalized.every((origin): origin is string => origin !== null)
      ? normalized
      : [];
  } catch {
    // A malformed configured value fails closed instead of silently becoming
    // a legacy/unrestricted integration.
    return [];
  }
}

/** Accept an HTTPS serialized origin, then normalize host case and port 443. */
export function normalizeOrigin(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value !== value.trim()) return null;

  const match = SERIALIZED_HTTPS_ORIGIN.exec(value);
  if (!match) return null;

  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== match[1].toLowerCase() ||
      parsed.username || parsed.password ||
      parsed.pathname !== "/" || parsed.search || parsed.hash
    ) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Enforce configured origins against the actual browser Origin header.
 * Missing or malformed Origin values fail closed whenever an allowlist exists.
 */
export function isWebsiteChatOriginAllowed(
  serializedAllowedOrigins: string | null | undefined,
  requestOrigin: string | null | undefined,
): boolean {
  const allowedOrigins = parseAllowedOrigins(serializedAllowedOrigins);
  if (allowedOrigins === null) return true;

  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
  return normalizedRequestOrigin !== null && allowedOrigins.includes(normalizedRequestOrigin);
}

export type WebsiteChatCorsHeaders = Record<string, string>;

/**
 * Build the browser transport headers only for an explicitly configured,
 * exact-match origin. Legacy integrations without an allowlist remain
 * compatible with the application authorization policy, but do not receive
 * a permissive CORS response until an administrator configures one.
 */
export function getWebsiteChatCorsHeaders(
  serializedAllowedOrigins: string | null | undefined,
  requestOrigin: string | null | undefined,
): WebsiteChatCorsHeaders | null {
  const allowedOrigins = parseAllowedOrigins(serializedAllowedOrigins);
  if (allowedOrigins === null) return null;

  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
  if (
    normalizedRequestOrigin === null ||
    !allowedOrigins.includes(normalizedRequestOrigin)
  ) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": normalizedRequestOrigin,
    Vary: "Origin",
  };
}

/** Add the method/header contract required by the JSON POST preflight. */
export function getWebsiteChatPreflightHeaders(
  serializedAllowedOrigins: string | null | undefined,
  requestOrigin: string | null | undefined,
): WebsiteChatCorsHeaders | null {
  const corsHeaders = getWebsiteChatCorsHeaders(
    serializedAllowedOrigins,
    requestOrigin,
  );
  if (!corsHeaders) return null;

  return {
    ...corsHeaders,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export const KORA_PRODUCTION_WIDGET_ORIGINS = [
  "https://koraafric.com",
  "https://www.koraafric.com",
] as const;
