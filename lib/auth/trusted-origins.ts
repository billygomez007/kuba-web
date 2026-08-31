/**
 * Trusted-origin computation for Better Auth.
 *
 * Kept as a small, pure, dependency-free module — no db, no email client —
 * separate from lib/auth.ts, so this security-sensitive logic can be unit
 * tested in isolation and audited in one place.
 *
 * SECURITY: nothing in here ever reads a client-supplied Origin/Referer
 * header. Every entry comes from server-controlled configuration
 * (BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL/PUBLIC_APP_URL) or from Vercel's
 * own system environment variables (VERCEL_URL, VERCEL_BRANCH_URL), which
 * are set by the Vercel platform itself and are not attacker-controlled.
 */

const HOSTNAME_PATTERN =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Normalizes a Vercel-provided deployment URL value (VERCEL_URL,
 * VERCEL_BRANCH_URL) into an origin string Better Auth can trust.
 *
 * Vercel populates these as a bare hostname with no scheme, e.g.
 * "kuba-web-git-feature-outreach-ai-employee-kuba-web.vercel.app" — this
 * also accepts an already-absolute URL defensively, normalizing it down to
 * its origin. Returns null for anything malformed or non-HTTPS; callers
 * must treat null as "do not trust this value" rather than guessing.
 */
export function normalizeVercelOrigin(
  value: string | undefined | null,
): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  // Looks like it already has a scheme (e.g. "https://host" or "http://host").
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) {
    let url: URL;

    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }

    if (url.protocol !== "https:") {
      return null;
    }

    if (!HOSTNAME_PATTERN.test(url.hostname)) {
      return null;
    }

    return url.origin;
  }

  // Bare hostname form — Vercel's actual convention for VERCEL_URL /
  // VERCEL_BRANCH_URL. Validated strictly rather than left to the lenient
  // URL parser, so a value containing a path, query, whitespace, or other
  // unexpected characters is rejected instead of silently reinterpreted.
  if (!HOSTNAME_PATTERN.test(trimmed)) {
    return null;
  }

  return `https://${trimmed}`;
}

export type TrustedOriginsInput = {
  isProduction: boolean;
  vercelEnv?: string;
  vercelUrl?: string;
  vercelBranchUrl?: string;
  configuredAuthURL?: string | null;
  configuredAppURL?: string | null;
};

const PRODUCTION_ORIGINS = [
  "https://superkuba.com",
  "https://www.superkuba.com",
];

const LOCALHOST_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
];

/**
 * Computes the full Better Auth `trustedOrigins` list.
 *
 * Vercel Preview deployment origins (VERCEL_URL / VERCEL_BRANCH_URL) are
 * only ever included when vercelEnv === "preview" — a Production
 * deployment never automatically trusts a Vercel deployment hostname, and
 * there is no `*.vercel.app` wildcard: each candidate value is normalized
 * and validated individually, and only included when it actually came
 * from Vercel's own environment variables for this specific deployment.
 */
export function computeTrustedOrigins({
  isProduction,
  vercelEnv,
  vercelUrl,
  vercelBranchUrl,
  configuredAuthURL,
  configuredAppURL,
}: TrustedOriginsInput): string[] {
  const isPreview = vercelEnv === "preview";

  const vercelPreviewOrigins = isPreview
    ? [
        normalizeVercelOrigin(vercelUrl),
        normalizeVercelOrigin(vercelBranchUrl),
      ].filter((origin): origin is string => origin !== null)
    : [];

  const origins = [
    ...PRODUCTION_ORIGINS,
    ...(configuredAuthURL ? [configuredAuthURL] : []),
    ...(configuredAppURL ? [configuredAppURL] : []),
    ...vercelPreviewOrigins,
    ...(!isProduction ? LOCALHOST_ORIGINS : []),
  ];

  return [...new Set(origins)];
}
