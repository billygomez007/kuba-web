import assert from "node:assert/strict";
import { test } from "node:test";

const {
  isWebsiteChatOriginAllowed,
  KORA_PRODUCTION_WIDGET_ORIGINS,
  normalizeOrigin,
  parseAllowedOrigins,
  getWebsiteChatCorsHeaders,
  getWebsiteChatPreflightHeaders,
} = await import("../lib/integrations/website-chat-origin.ts");

const koraOrigins = JSON.stringify([
  "https://koraafric.com",
  "https://www.koraafric.com",
]);

test("allows the two configured Kora production origins", () => {
  assert.deepEqual(KORA_PRODUCTION_WIDGET_ORIGINS, [
    "https://koraafric.com",
    "https://www.koraafric.com",
  ]);
  assert.equal(isWebsiteChatOriginAllowed(koraOrigins, "https://koraafric.com"), true);
  assert.equal(isWebsiteChatOriginAllowed(koraOrigins, "https://www.koraafric.com"), true);
});

test("rejects unapproved, lookalike, insecure, and missing origins", () => {
  for (const origin of [
    "https://evil.example",
    "https://koraafric.com.evil.example",
    "https://evil-koraafric.com",
    "http://koraafric.com",
    null,
    "not an origin",
  ]) {
    assert.equal(isWebsiteChatOriginAllowed(koraOrigins, origin), false, origin ?? "missing");
  }
});

test("keeps legacy integrations compatible only when the field is absent", () => {
  assert.equal(isWebsiteChatOriginAllowed(null, "https://any.example"), true);
  assert.equal(isWebsiteChatOriginAllowed("", "https://any.example"), true);
  assert.equal(isWebsiteChatOriginAllowed("[]", "https://any.example"), false);
  assert.deepEqual(parseAllowedOrigins("malformed"), []);
  assert.deepEqual(parseAllowedOrigins('["https://good.example", "evil"]'), []);
});

test("normalizes origins without accepting paths, credentials, or wildcards", () => {
  assert.equal(normalizeOrigin("https://koraafric.com/"), "https://koraafric.com");
  assert.equal(normalizeOrigin("https://koraafric.com/path"), null);
  assert.equal(normalizeOrigin("https://user:pass@koraafric.com"), null);
  assert.equal(normalizeOrigin("https://*.koraafric.com"), null);
});

test("returns the exact preflight contract for approved origins", () => {
  for (const origin of ["https://koraafric.com", "https://www.koraafric.com"]) {
    assert.deepEqual(getWebsiteChatPreflightHeaders(koraOrigins, origin), {
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
  }
});

test("denies CORS headers for rejected, missing, malformed, and legacy origins", () => {
  for (const origin of [
    "https://evil.example",
    "https://koraafric.com.evil.example",
    "http://koraafric.com",
    "https://koraafric.com:444",
    null,
    "not an origin",
  ]) {
    assert.equal(getWebsiteChatPreflightHeaders(koraOrigins, origin), null);
  }

  assert.equal(getWebsiteChatPreflightHeaders(null, "https://koraafric.com"), null);
  assert.equal(getWebsiteChatPreflightHeaders("malformed", "https://koraafric.com"), null);
});

test("returns only exact origin headers for approved POST responses", () => {
  for (const origin of ["https://koraafric.com", "https://www.koraafric.com"]) {
    assert.deepEqual(getWebsiteChatCorsHeaders(koraOrigins, origin), {
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
    });
  }
});
