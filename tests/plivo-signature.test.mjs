import { register } from "node:module";
import { pathToFileURL } from "node:url";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

register(pathToFileURL(new URL("./helpers/alias-loader.mjs", import.meta.url).pathname));

const { verifyPlivoSignature } = await import("../lib/voice/plivo-signature.ts");

const AUTH_TOKEN = "test-plivo-auth-token";

function sign(url, nonce) {
  return crypto.createHmac("sha256", AUTH_TOKEN).update(Buffer.from(`${url}${nonce}`, "utf-8")).digest("base64");
}

test.before(() => { process.env.PLIVO_AUTH_TOKEN = AUTH_TOKEN; });

test("REGRESSION: a genuinely valid signature is accepted", () => {
  const url = "https://app.superkuba.test/api/voice/plivo/answer";
  const nonce = "abc123";
  assert.equal(verifyPlivoSignature(url, nonce, sign(url, nonce)), true);
});

test("a signature computed with the wrong auth token is rejected", () => {
  const url = "https://app.superkuba.test/api/voice/plivo/answer";
  const nonce = "abc123";
  const wrongSignature = crypto.createHmac("sha256", "wrong-token").update(Buffer.from(`${url}${nonce}`, "utf-8")).digest("base64");
  assert.equal(verifyPlivoSignature(url, nonce, wrongSignature), false);
});

test("a signature computed over a different URL (tampered) is rejected", () => {
  const nonce = "abc123";
  const signature = sign("https://app.superkuba.test/api/voice/plivo/answer", nonce);
  assert.equal(verifyPlivoSignature("https://app.superkuba.test/api/voice/plivo/answer?employeeId=evil", nonce, signature), false);
});

test("query-string tampering is caught (the signature covers the full URL including query params)", () => {
  const nonce = "abc123";
  const originalUrl = "https://app.superkuba.test/api/voice/plivo/answer?employeeId=emp-1&conversationId=conv-1";
  const signature = sign(originalUrl, nonce);
  const tamperedUrl = "https://app.superkuba.test/api/voice/plivo/answer?employeeId=emp-2&conversationId=conv-1";
  assert.equal(verifyPlivoSignature(tamperedUrl, nonce, signature), false);
});

test("fails closed when the nonce header is missing", () => {
  const url = "https://app.superkuba.test/api/voice/plivo/answer";
  assert.equal(verifyPlivoSignature(url, null, sign(url, "abc123")), false);
});

test("fails closed when the signature header is missing", () => {
  const url = "https://app.superkuba.test/api/voice/plivo/answer";
  assert.equal(verifyPlivoSignature(url, "abc123", null), false);
});

test("fails closed when PLIVO_AUTH_TOKEN is not configured", () => {
  const original = process.env.PLIVO_AUTH_TOKEN;
  delete process.env.PLIVO_AUTH_TOKEN;
  try {
    const url = "https://app.superkuba.test/api/voice/plivo/answer";
    assert.equal(verifyPlivoSignature(url, "abc123", sign(url, "abc123")), false);
  } finally {
    process.env.PLIVO_AUTH_TOKEN = original;
  }
});

test("does not throw on a garbage signature value", () => {
  assert.doesNotThrow(() => verifyPlivoSignature("https://app.superkuba.test/x", "n", "not-valid-base64!!!"));
});
