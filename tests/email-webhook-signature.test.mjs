// Unit tests for lib/email/webhook-signature.ts — Svix-style HMAC
// verification for Resend's webhook (Phase 13: "Do not trust arbitrary
// public POST requests"). No DB, no network.
//
// Regression coverage: an earlier version of verifyResendWebhookSignature
// compared the *base64 string's own bytes* against the *decoded* candidate
// signature bytes, so their lengths could never match and every valid
// signature was rejected unconditionally. The "a genuinely valid signature
// is accepted" test below is the one that originally caught this.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

const { verifyResendWebhookSignature } = await import("@/lib/email/webhook-signature");

const KEY_BYTES = crypto.randomBytes(24);
const SECRET = `whsec_${KEY_BYTES.toString("base64")}`;
const BODY = JSON.stringify({ type: "email.received", data: { email_id: "evt-1" } });

function sign(body, keyBytes, timestamp) {
  const svixId = "msg_test";
  const svixTimestamp = timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = crypto.createHmac("sha256", keyBytes).update(`${svixId}.${svixTimestamp}.${body}`).digest("base64");
  return { svixId, svixTimestamp, svixSignature: `v1,${signature}` };
}

test("REGRESSION: a genuinely valid signature is accepted", () => {
  const { svixId, svixTimestamp, svixSignature } = sign(BODY, KEY_BYTES);
  const result = verifyResendWebhookSignature(BODY, { svixId, svixTimestamp, svixSignature }, SECRET);
  assert.equal(result, true);
});

test("a signature computed with the wrong secret is rejected", () => {
  const { svixId, svixTimestamp, svixSignature } = sign(BODY, crypto.randomBytes(24));
  assert.equal(verifyResendWebhookSignature(BODY, { svixId, svixTimestamp, svixSignature }, SECRET), false);
});

test("a signature computed over a different body (tampered payload) is rejected", () => {
  const { svixId, svixTimestamp, svixSignature } = sign(BODY, KEY_BYTES);
  const tamperedBody = JSON.stringify({ type: "email.received", data: { email_id: "evt-ATTACKER" } });
  assert.equal(verifyResendWebhookSignature(tamperedBody, { svixId, svixTimestamp, svixSignature }, SECRET), false);
});

test("REPLAY PROTECTION: a signature with a timestamp far in the past is rejected even though the signature itself is valid", () => {
  const oldTimestamp = String(Math.floor(Date.now() / 1000) - 3600); // 1 hour old
  const { svixId, svixSignature } = sign(BODY, KEY_BYTES, oldTimestamp);
  assert.equal(verifyResendWebhookSignature(BODY, { svixId, svixTimestamp: oldTimestamp, svixSignature }, SECRET), false);
});

test("a timestamp within tolerance (just under 5 minutes old) is accepted", () => {
  const recentTimestamp = String(Math.floor(Date.now() / 1000) - 60);
  const { svixId, svixSignature } = sign(BODY, KEY_BYTES, recentTimestamp);
  assert.equal(verifyResendWebhookSignature(BODY, { svixId, svixTimestamp: recentTimestamp, svixSignature }, SECRET), true);
});

test("KEY ROTATION: a svix-signature header carrying multiple space-separated v1 values is accepted if ANY one matches", () => {
  const { svixId, svixTimestamp, svixSignature } = sign(BODY, KEY_BYTES);
  const bogus = "v1,bm90LXRoZS1yaWdodC1zaWc=";
  const combined = `${bogus} ${svixSignature}`;
  assert.equal(verifyResendWebhookSignature(BODY, { svixId, svixTimestamp, svixSignature: combined }, SECRET), true);
});

test("fails closed when any required header is missing", () => {
  const { svixId, svixTimestamp, svixSignature } = sign(BODY, KEY_BYTES);
  assert.equal(verifyResendWebhookSignature(BODY, { svixId: null, svixTimestamp, svixSignature }, SECRET), false);
  assert.equal(verifyResendWebhookSignature(BODY, { svixId, svixTimestamp: null, svixSignature }, SECRET), false);
  assert.equal(verifyResendWebhookSignature(BODY, { svixId, svixTimestamp, svixSignature: null }, SECRET), false);
});

test("fails closed when no secret is configured", () => {
  const { svixId, svixTimestamp, svixSignature } = sign(BODY, KEY_BYTES);
  assert.equal(verifyResendWebhookSignature(BODY, { svixId, svixTimestamp, svixSignature }, null), false);
  assert.equal(verifyResendWebhookSignature(BODY, { svixId, svixTimestamp, svixSignature }, undefined), false);
});

test("does not throw on a garbage/malformed svix-signature header", () => {
  const { svixId, svixTimestamp } = sign(BODY, KEY_BYTES);
  assert.doesNotThrow(() => verifyResendWebhookSignature(BODY, { svixId, svixTimestamp, svixSignature: "not-a-real-signature-at-all" }, SECRET));
  assert.equal(verifyResendWebhookSignature(BODY, { svixId, svixTimestamp, svixSignature: "not-a-real-signature-at-all" }, SECRET), false);
});

test("does not throw when the timestamp header is non-numeric", () => {
  const { svixId, svixSignature } = sign(BODY, KEY_BYTES, "not-a-number");
  assert.doesNotThrow(() => verifyResendWebhookSignature(BODY, { svixId, svixTimestamp: "not-a-number", svixSignature }, SECRET));
  assert.equal(verifyResendWebhookSignature(BODY, { svixId, svixTimestamp: "not-a-number", svixSignature }, SECRET), false);
});
