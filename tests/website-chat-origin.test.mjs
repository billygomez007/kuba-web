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
  assert.equal(normalizeOrigin("https://koraafric.com/"), null);
  assert.equal(normalizeOrigin("https://koraafric.com/path"), null);
  assert.equal(normalizeOrigin("https://user:pass@koraafric.com"), null);
  assert.equal(normalizeOrigin("https://*.koraafric.com"), null);
});

test("rejects malformed serialized origins before URL canonicalization", () => {
  for (const origin of [
    "https:koraafric.com",
    "https:/koraafric.com",
    "https:///koraafric.com",
    "https://koraafric.com/",
    "https://koraafric.com?",
    "https://koraafric.com#",
    "https://koraafric.com/path",
    "https://user@koraafric.com",
    "https://user:pass@koraafric.com",
    "https://koraafric.com https://www.koraafric.com",
    "https://koraafric.com,https://www.koraafric.com",
    " https://koraafric.com",
    "https://koraafric.com ",
    "https://koraafric.com\n",
    "https://koraafric.com\\",
    "https://koraafric%2ecom",
    "https://koraafric.com:",
    "https://koraafric.com:0443",
    "https://koraafric.com:65536",
    "https://127.1",
    "https://[2001:0db8::1]",
    "null",
    "file://koraafric.com",
    "javascript:alert(1)",
    "data:text/plain,hello",
    "http://koraafric.com",
    "http://localhost:3000",
    null,
    undefined,
  ]) {
    assert.equal(normalizeOrigin(origin), null, String(origin));
    assert.equal(isWebsiteChatOriginAllowed(koraOrigins, origin), false, String(origin));
    assert.equal(getWebsiteChatPreflightHeaders(koraOrigins, origin), null, String(origin));
    assert.equal(getWebsiteChatCorsHeaders(koraOrigins, origin), null, String(origin));
  }
});

test("normalizes host casing and explicit HTTPS default ports", () => {
  assert.equal(normalizeOrigin("HTTPS://KoraAfric.COM:443"), "https://koraafric.com");
  assert.equal(isWebsiteChatOriginAllowed(koraOrigins, "https://KORAAFRIC.COM:443"), true);
  assert.deepEqual(parseAllowedOrigins('["https://KORAAFRIC.COM:443"]'), ["https://koraafric.com"]);
  assert.equal(normalizeOrigin("https://koraafric.com:8443"), "https://koraafric.com:8443");
  assert.equal(isWebsiteChatOriginAllowed(koraOrigins, "https://koraafric.com:8443"), false);
  assert.equal(normalizeOrigin("https://192.0.2.1"), "https://192.0.2.1");
  assert.equal(normalizeOrigin("https://[2001:db8::1]:8443"), "https://[2001:db8::1]:8443");
  assert.equal(normalizeOrigin("https://xn--bcher-kva.example"), "https://xn--bcher-kva.example");
});

test("malformed and HTTP configuration fails closed without weakening legacy null", () => {
  for (const origin of ["https:koraafric.com", "https://koraafric.com?", "http://koraafric.com"]) {
    const config = JSON.stringify([origin]);
    assert.deepEqual(parseAllowedOrigins(config), []);
    assert.equal(isWebsiteChatOriginAllowed(config, "https://koraafric.com"), false);
  }
  assert.equal(isWebsiteChatOriginAllowed(null, null), true);
  assert.equal(getWebsiteChatCorsHeaders(null, "https://koraafric.com"), null);
});

test("keeps the production origin targets exact", () => {
  for (const origin of ["https://sub.koraafric.com", "https://evil-koraafric.com", "https://koraafric.com.evil.example"]) {
    assert.equal(isWebsiteChatOriginAllowed(koraOrigins, origin), false);
  }
  const realtegic = '["https://www.realtegicworks.com"]';
  assert.equal(isWebsiteChatOriginAllowed(realtegic, "https://www.realtegicworks.com"), true);
  assert.equal(isWebsiteChatOriginAllowed(realtegic, "https://realtegicworks.com"), false);
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
