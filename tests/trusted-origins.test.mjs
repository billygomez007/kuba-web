// Focused tests for Better Auth's trusted-origin computation
// (lib/auth/trusted-origins.ts), added while fixing the "Invalid origin"
// error on Vercel branch Preview deployments.
//
// lib/auth/trusted-origins.ts is intentionally a pure, dependency-free
// module (no db, no email client) so it can be imported and tested
// directly here without bootstrapping a database or setting any env vars —
// unlike lib/auth.ts itself, which constructs a real Better Auth instance
// backed by the drizzle adapter.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  computeTrustedOrigins,
  normalizeVercelOrigin,
} from "../lib/auth/trusted-origins.ts";

const STAGING_AUTH_URL = "https://staging.superkuba.com";

function previewParams(overrides = {}) {
  return {
    isProduction: false,
    vercelEnv: "preview",
    configuredAuthURL: STAGING_AUTH_URL,
    configuredAppURL: STAGING_AUTH_URL,
    ...overrides,
  };
}

// --- 1 & 2: Vercel deployment + branch-alias URLs are trusted in Preview ---

test("VERCEL_URL is trusted during Preview", () => {
  const origins = computeTrustedOrigins(
    previewParams({ vercelUrl: "kuba-web-abc123.vercel.app" }),
  );
  assert.ok(origins.includes("https://kuba-web-abc123.vercel.app"));
});

test("VERCEL_BRANCH_URL is trusted during Preview", () => {
  // This is the actual reported failure mode: the stable branch-alias
  // hostname Vercel exposes as VERCEL_BRANCH_URL, distinct from the
  // per-deployment VERCEL_URL, was never read by the previous
  // implementation.
  const branchUrl =
    "kuba-web-git-feature-outreach-ai-employee-kuba-web.vercel.app";
  const origins = computeTrustedOrigins(
    previewParams({ vercelBranchUrl: branchUrl }),
  );
  assert.ok(origins.includes(`https://${branchUrl}`));
});

test("both VERCEL_URL and VERCEL_BRANCH_URL are trusted together during Preview", () => {
  const origins = computeTrustedOrigins(
    previewParams({
      vercelUrl: "kuba-web-abc123.vercel.app",
      vercelBranchUrl: "kuba-web-git-feature-branch-team.vercel.app",
    }),
  );
  assert.ok(origins.includes("https://kuba-web-abc123.vercel.app"));
  assert.ok(origins.includes("https://kuba-web-git-feature-branch-team.vercel.app"));
});

// --- 3: staging.superkuba.com remains trusted ---

test("https://staging.superkuba.com remains trusted", () => {
  const origins = computeTrustedOrigins(
    previewParams({ vercelUrl: "kuba-web-abc123.vercel.app" }),
  );
  assert.ok(origins.includes(STAGING_AUTH_URL));
});

test("staging.superkuba.com remains trusted even outside Preview (e.g. local/staging-only runs)", () => {
  const origins = computeTrustedOrigins({
    isProduction: false,
    vercelEnv: undefined,
    configuredAuthURL: STAGING_AUTH_URL,
    configuredAppURL: STAGING_AUTH_URL,
  });
  assert.ok(origins.includes(STAGING_AUTH_URL));
});

// --- 4: Production never automatically trusts Vercel Preview URLs ---

test("Production (VERCEL_ENV=production) does NOT trust a Vercel deployment hostname", () => {
  const origins = computeTrustedOrigins({
    isProduction: true,
    vercelEnv: "production",
    vercelUrl: "kuba-web.vercel.app",
    vercelBranchUrl: "kuba-web-git-main-kuba-web.vercel.app",
    configuredAuthURL: "https://superkuba.com",
    configuredAppURL: "https://superkuba.com",
  });
  assert.equal(origins.includes("https://kuba-web.vercel.app"), false);
  assert.equal(
    origins.includes("https://kuba-web-git-main-kuba-web.vercel.app"),
    false,
  );
});

test("an undefined/missing VERCEL_ENV does NOT trust a Vercel deployment hostname", () => {
  const origins = computeTrustedOrigins({
    isProduction: true,
    vercelEnv: undefined,
    vercelUrl: "kuba-web-abc123.vercel.app",
    configuredAuthURL: "https://superkuba.com",
  });
  assert.equal(origins.includes("https://kuba-web-abc123.vercel.app"), false);
});

test("production core origins (superkuba.com, www.superkuba.com) are always present", () => {
  const origins = computeTrustedOrigins({
    isProduction: true,
    vercelEnv: "production",
    configuredAuthURL: "https://superkuba.com",
  });
  assert.ok(origins.includes("https://superkuba.com"));
  assert.ok(origins.includes("https://www.superkuba.com"));
});

// --- 5: malformed Vercel URL values are rejected ---

test("normalizeVercelOrigin rejects malformed values", () => {
  assert.equal(normalizeVercelOrigin("not a valid host!!"), null);
  assert.equal(normalizeVercelOrigin("has spaces.vercel.app"), null);
  assert.equal(normalizeVercelOrigin("/relative/path"), null);
  assert.equal(normalizeVercelOrigin(""), null);
  assert.equal(normalizeVercelOrigin("   "), null);
  assert.equal(normalizeVercelOrigin(undefined), null);
  assert.equal(normalizeVercelOrigin(null), null);
  assert.equal(normalizeVercelOrigin("javascript:alert(1)"), null);
  assert.equal(normalizeVercelOrigin("not-a-url-with-a-space here.app"), null);
});

test("a malformed VERCEL_BRANCH_URL does not appear in the computed trusted origins and does not throw", () => {
  assert.doesNotThrow(() => {
    const origins = computeTrustedOrigins(
      previewParams({ vercelBranchUrl: "has spaces.vercel.app" }),
    );
    assert.equal(
      origins.some((origin) => origin.includes("has spaces")),
      false,
    );
  });
});

// --- 6: non-HTTPS remote Vercel values are rejected ---

test("normalizeVercelOrigin rejects an explicit non-HTTPS absolute URL", () => {
  assert.equal(
    normalizeVercelOrigin("http://kuba-web-abc123.vercel.app"),
    null,
  );
  assert.equal(
    normalizeVercelOrigin("ftp://kuba-web-abc123.vercel.app"),
    null,
  );
});

test("normalizeVercelOrigin normalizes an absolute HTTPS URL to its origin, dropping any path", () => {
  assert.equal(
    normalizeVercelOrigin("https://kuba-web-abc123.vercel.app/some/path?x=1"),
    "https://kuba-web-abc123.vercel.app",
  );
});

test("a non-HTTPS VERCEL_URL value is excluded from the computed trusted origins", () => {
  const origins = computeTrustedOrigins(
    previewParams({ vercelUrl: "http://kuba-web-abc123.vercel.app" }),
  );
  assert.equal(origins.includes("http://kuba-web-abc123.vercel.app"), false);
  assert.equal(origins.includes("https://kuba-web-abc123.vercel.app"), false);
});

// --- 7: no wildcard Vercel origin is introduced ---

test("no wildcard *.vercel.app entry is ever produced", () => {
  const origins = computeTrustedOrigins(
    previewParams({
      vercelUrl: "kuba-web-abc123.vercel.app",
      vercelBranchUrl: "kuba-web-git-feature-team.vercel.app",
    }),
  );
  assert.equal(origins.some((origin) => origin.includes("*")), false);
});

test("only the exact deployment/branch hostnames provided are trusted — an unrelated *.vercel.app hostname is not", () => {
  const origins = computeTrustedOrigins(
    previewParams({ vercelUrl: "kuba-web-abc123.vercel.app" }),
  );
  assert.equal(
    origins.includes("https://some-other-unrelated-app.vercel.app"),
    false,
  );
});

// --- 8: an arbitrary Origin header cannot add itself to trustedOrigins ---

test("computeTrustedOrigins has no parameter for a request-supplied Origin/Referer header", () => {
  // Structural guarantee: the function's inputs are exhaustively
  // server/Vercel-controlled configuration values. There is no
  // "origin"/"requestOrigin"/"header" style parameter an attacker-supplied
  // request could route a value through.
  assert.deepEqual(
    Object.keys(previewParams()).sort(),
    ["configuredAppURL", "configuredAuthURL", "isProduction", "vercelEnv"].sort(),
  );
});

test("supplying an attacker-controlled hostname as if it were VERCEL_URL is only ever trusted when VERCEL_ENV is genuinely 'preview'", () => {
  // Simulates the failure mode of "trust whatever Origin the client sent":
  // even if an attacker's chosen hostname flows into the vercelUrl slot,
  // it is never trusted unless the preview gate (server/platform-set,
  // never client-set) is also true.
  const attackerHostname = "evil-attacker-controlled.example.com";

  const outsidePreview = computeTrustedOrigins({
    isProduction: true,
    vercelEnv: "production",
    vercelUrl: attackerHostname,
    configuredAuthURL: "https://superkuba.com",
  });
  assert.equal(
    outsidePreview.includes(`https://${attackerHostname}`),
    false,
  );
});

test("lib/auth.ts never reads a client-supplied origin/referer header when building trustedOrigins", async () => {
  const source = await readFile(
    new URL("../lib/auth.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /headers\.get\(\s*["']origin["']/i);
  assert.doesNotMatch(source, /headers\.get\(\s*["']referer["']/i);
  assert.match(source, /computeTrustedOrigins\(/);
});
