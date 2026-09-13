/**
 * Website normalization for the onboarding Step 2 form (and anywhere else a
 * business's website is saved). A non-technical business owner should
 * never be required to know URL-scheme syntax: a bare domain like
 * "example.com" is accepted and normalized to "https://example.com/"
 * rather than rejected outright.
 *
 * Security requirement, not just UX: only http/https may ever be accepted.
 * A scheme is detected explicitly (any "<letters>:" prefix, matched before
 * "https://" is ever prepended) so "javascript:...", "data:...", "file:...",
 * "mailto:...", etc. are rejected as a distinct, explicit case — never
 * silently reinterpreted as part of a hostname the way prepending a scheme
 * blindly could.
 */

const SCHEME_PATTERN = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

export type WebsiteNormalizationResult =
  | { value: string | null; error: null }
  | { value: null; error: string };

export function normalizeWebsiteUrl(input: string): WebsiteNormalizationResult {
  const trimmed = input.trim();

  // Optional field — blank is valid and means "not provided."
  if (!trimmed) {
    return { value: null, error: null };
  }

  const schemeMatch = trimmed.match(SCHEME_PATTERN);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== "http" && scheme !== "https") {
      return { value: null, error: "Website must be a valid web address." };
    }
  }

  // No recognized scheme at all (a bare domain) — assume https, the
  // overwhelmingly common case, rather than rejecting a perfectly normal
  // bare-domain entry.
  const candidate = schemeMatch ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { value: null, error: "Website must be a valid web address." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { value: null, error: "Website must be a valid web address." };
  }
  if (!url.hostname || !url.hostname.includes(".")) {
    return { value: null, error: "Website must be a valid web address." };
  }

  return { value: url.toString(), error: null };
}
