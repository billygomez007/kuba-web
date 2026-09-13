// Regression tests for the Preview secure-session persistence bug: a Vercel
// Preview deployment (NODE_ENV=production, VERCEL_ENV=preview) was being
// given a session cookie scoped to Domain=.superkuba.com — every browser
// correctly rejects that Set-Cookie outright for a response served from
// *.vercel.app (the domain attribute doesn't match the response's own
// host), so sign-in succeeded server-side but the browser never retained
// the session. Root cause: lib/auth.ts gated cross-subdomain-cookie
// behavior on `NODE_ENV === "production"`, which is true for every
// deployed Next.js build (Preview included) and does not distinguish
// which Vercel environment the build is actually running in.
//
// lib/auth/production-domain.ts is kept as its own pure, dependency-free
// function (matching lib/auth/trusted-origins.ts's own pattern) specifically
// so this can be unit tested without constructing a real Better Auth
// instance (which needs a live db).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isProductionDomain } from "../lib/auth/production-domain.ts";

// --- 1. The pure decision function itself ---

test("Production on Vercel (VERCEL_ENV=production) is the production domain, regardless of NODE_ENV", () => {
  assert.equal(isProductionDomain({ nodeEnv: "production", vercelEnv: "production" }), true);
});

test("Preview on Vercel (VERCEL_ENV=preview, NODE_ENV=production) is NOT the production domain — this is the exact bug scenario", () => {
  assert.equal(isProductionDomain({ nodeEnv: "production", vercelEnv: "preview" }), false);
});

test("Vercel development environment (VERCEL_ENV=development) is NOT the production domain", () => {
  assert.equal(isProductionDomain({ nodeEnv: "production", vercelEnv: "development" }), false);
});

test("local development (no VERCEL_ENV, NODE_ENV=development) is NOT the production domain", () => {
  assert.equal(isProductionDomain({ nodeEnv: "development", vercelEnv: undefined }), false);
});

test("local development running with NODE_ENV=production but no VERCEL_ENV (e.g. `next start` locally) falls back to NODE_ENV — this is a rarer case but must not crash or misbehave", () => {
  assert.equal(isProductionDomain({ nodeEnv: "production", vercelEnv: undefined }), true);
});

test("non-Vercel production hosting (no VERCEL_ENV at all, NODE_ENV=production) correctly falls back to NODE_ENV", () => {
  assert.equal(isProductionDomain({ nodeEnv: "production", vercelEnv: undefined }), true);
});

test("an empty-string VERCEL_ENV is treated as absent (falls back to NODE_ENV), not as a falsy 'not production' answer on its own", () => {
  assert.equal(isProductionDomain({ nodeEnv: "development", vercelEnv: "" }), false);
  assert.equal(isProductionDomain({ nodeEnv: "production", vercelEnv: "" }), true);
});

// --- 2. lib/auth.ts wiring: the fix actually gates the right things ---

let authSource;
test.before(async () => {
  authSource = await readFile(new URL("../lib/auth.ts", import.meta.url), "utf8");
});

test("lib/auth.ts imports and uses isProductionDomain from the dedicated pure module, not an inline NODE_ENV check", () => {
  assert.match(authSource, /from ["']@\/lib\/auth\/production-domain["']/);
  assert.match(authSource, /onProductionDomain\s*=\s*isProductionDomain\(/);
});

test("crossSubDomainCookies is gated on onProductionDomain, not the raw NODE_ENV-based isProduction flag", () => {
  const advancedBlock = authSource.slice(authSource.indexOf("advanced: {"), authSource.indexOf("rateLimit: {"));
  assert.match(advancedBlock, /crossSubDomainCookies:\s*\{\s*enabled:\s*onProductionDomain/);
  assert.match(advancedBlock, /domain:\s*onProductionDomain/);
  assert.doesNotMatch(advancedBlock, /enabled:\s*isProduction[,\s]/, "must not use the plain NODE_ENV-based flag here — that was the bug");
});

test("defaultCookieAttributes (secure/sameSite=none/partitioned) is gated on onProductionDomain, not isProduction", () => {
  const advancedBlock = authSource.slice(authSource.indexOf("advanced: {"), authSource.indexOf("rateLimit: {"));
  assert.match(advancedBlock, /defaultCookieAttributes:\s*onProductionDomain/);
});

test("baseURL's production fallback uses onProductionDomain, not isProduction", () => {
  const baseUrlBlock = authSource.slice(authSource.indexOf("const baseURL"), authSource.indexOf("export const auth"));
  assert.match(baseUrlBlock, /onProductionDomain \? PRODUCTION_URL/);
});

test("trustedOrigins receives onProductionDomain (via computeTrustedOrigins's isProduction param), not the raw NODE_ENV flag", () => {
  const trustedOriginsCall = authSource.slice(authSource.indexOf("computeTrustedOrigins({"), authSource.indexOf("advanced: {"));
  assert.match(trustedOriginsCall, /isProduction:\s*onProductionDomain/);
});

test("rate limiting is intentionally left on the original NODE_ENV-based flag (unrelated to the cookie bug, no behavior change intended for it)", () => {
  const rateLimitBlock = authSource.slice(authSource.indexOf("rateLimit: {"), authSource.indexOf("emailAndPassword: {"));
  assert.match(rateLimitBlock, /enabled:\s*isProduction[,\s]/);
});

// --- 3. No unsafe shared .vercel.app cookie domain, ever ---

test("no literal .vercel.app (or vercel.app) cookie/domain value ever appears in lib/auth.ts", () => {
  assert.doesNotMatch(authSource, /vercel\.app/i);
});

test("the only hard-coded cross-subdomain cookie Domain value remains the real production domain, never a wildcard", () => {
  assert.match(authSource, /"\.superkuba\.com"/);
  assert.doesNotMatch(authSource, /domain:\s*["']\*/, "no wildcard domain value");
});

// --- 4. Production security flags are preserved exactly as before ---

test("production cookie attributes are unchanged: httpOnly, secure, sameSite=none, partitioned all still present under onProductionDomain", () => {
  const advancedBlock = authSource.slice(authSource.indexOf("advanced: {"), authSource.indexOf("rateLimit: {"));
  assert.match(advancedBlock, /httpOnly:\s*true/);
  assert.match(advancedBlock, /secure:\s*true/);
  assert.match(advancedBlock, /sameSite:\s*"none"/);
  assert.match(advancedBlock, /partitioned:\s*true/);
});

// --- 5. Preview/local fall through to {} / undefined — Better Auth's own
// host-only-cookie default — never a hand-rolled "insecure" override ---

test("the non-production branch is an empty object / undefined, never a weakened explicit override (e.g. secure:false, sameSite:'lax' hand-set here)", () => {
  const advancedBlock = authSource.slice(authSource.indexOf("advanced: {"), authSource.indexOf("rateLimit: {"));
  assert.match(advancedBlock, /: \{\}/, "defaultCookieAttributes' non-production branch must be an empty object, deferring to Better Auth's own defaults");
  assert.doesNotMatch(advancedBlock, /secure:\s*false/);
  assert.doesNotMatch(advancedBlock, /httpOnly:\s*false/);
});
