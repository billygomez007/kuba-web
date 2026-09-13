export type WebsiteChatMetadata = {
  domain?: string;
  welcomeMessage?: string;
  source?: string;
};

export function parseWebsiteChatMetadata(
  raw: string | null | undefined,
): WebsiteChatMetadata {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as WebsiteChatMetadata)
      : {};
  } catch {
    return {};
  }
}

// Strips protocol, path/query, port and a leading "www." from either a
// business-entered domain (e.g. "https://www.example.com/") or a request's
// Origin/Referer header, so both sides of the domain check are compared in
// the same normalized form. Returns null for anything that isn't a
// plausible bare hostname — no wildcards, no paths, no embedded credentials.
export function normalizeDomain(raw: string): string | null {
  let value = raw.trim().toLowerCase();
  if (!value) return null;

  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  value = value.split("/")[0];
  value = value.split("?")[0];
  value = value.split("@").pop() || value;
  value = value.split(":")[0];
  value = value.replace(/^www\./, "");

  const HOSTNAME_PATTERN =
    /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

  return HOSTNAME_PATTERN.test(value) ? value : null;
}
