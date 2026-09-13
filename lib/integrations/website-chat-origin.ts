const ORIGIN_PROTOCOLS = new Set(["http:", "https:"]);

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

/** Normalize an origin without accepting paths, credentials, or wildcards. */
export function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;

  const input = value.trim();
  if (!input || input.includes("*") || input.includes("\\")) return null;

  try {
    const parsed = new URL(input);
    if (!ORIGIN_PROTOCOLS.has(parsed.protocol)) return null;
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
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

export const KORA_PRODUCTION_WIDGET_ORIGINS = [
  "https://koraafric.com",
  "https://www.koraafric.com",
] as const;
