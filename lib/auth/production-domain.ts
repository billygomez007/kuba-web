/**
 * Whether a build is ACTUALLY serving on the real production domain — as
 * opposed to merely being a "production" Next.js build. `NODE_ENV` is
 * "production" for EVERY deployed build, Vercel Preview included, because
 * that's just how `next build`/`next start` work; it does not distinguish
 * which Vercel environment the build is deployed to.
 *
 * `VERCEL_ENV` is what Vercel itself sets to make that distinction —
 * exactly "production" | "preview" | "development" — and is authoritative
 * whenever it's present. Falls back to `NODE_ENV` only for non-Vercel
 * hosting, where there is no `VERCEL_ENV` to consult.
 *
 * Kept as its own small, pure, dependency-free function (same pattern as
 * lib/auth/trusted-origins.ts) so the exact bug this answers can be unit
 * tested without constructing a real Better Auth instance: using
 * `NODE_ENV === "production"` to decide whether to apply the
 * `Domain=.superkuba.com` session-cookie attribute meant a Vercel Preview
 * deployment (NODE_ENV=production, VERCEL_ENV=preview) was handed a cookie
 * scoped to a domain that does not match its own `*.vercel.app` hostname —
 * every browser correctly rejects that Set-Cookie outright, so sign-in
 * succeeded server-side but the browser never retained the session.
 */
export function isProductionDomain({
  nodeEnv,
  vercelEnv,
}: {
  nodeEnv?: string;
  vercelEnv?: string;
}): boolean {
  if (vercelEnv) {
    return vercelEnv === "production";
  }
  return nodeEnv === "production";
}
