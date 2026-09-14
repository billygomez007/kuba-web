// Unit tests for the signed reply-address token (lib/email/reply-token.ts)
// — the primary business-safe addressing mechanism for inbound email
// correlation (Phase 5-6). No DB, no network — pure function tests.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || "test-secret-for-reply-token-suite-at-least-32-chars";

test("createReplyToken + verifyReplyToken round-trips the exact payload", async () => {
  const { createReplyToken, verifyReplyToken } = await import("@/lib/email/reply-token");
  const payload = { businessId: "biz-1", conversationId: "conv-1", campaignId: "camp-1", recipientId: "recip-1", sendId: "send-1" };
  const token = createReplyToken(payload);
  const verified = verifyReplyToken(token);
  assert.deepEqual(verified, payload);
});

test("verifyReplyToken supports the minimal (non-campaign) shape — campaignId/recipientId/sendId are all optional", async () => {
  const { createReplyToken, verifyReplyToken } = await import("@/lib/email/reply-token");
  const token = createReplyToken({ businessId: "biz-1", conversationId: "conv-1" });
  const verified = verifyReplyToken(token);
  assert.equal(verified.businessId, "biz-1");
  assert.equal(verified.conversationId, "conv-1");
  assert.equal(verified.campaignId, undefined);
});

test("SECURITY: a tampered payload (businessId swapped after signing) is rejected", async () => {
  const { createReplyToken, verifyReplyToken } = await import("@/lib/email/reply-token");
  const token = createReplyToken({ businessId: "biz-1", conversationId: "conv-1" });
  const [encoded, signature] = token.split(".");
  const tamperedPayload = Buffer.from(JSON.stringify({ businessId: "biz-ATTACKER", conversationId: "conv-1" }), "utf8").toString("base64url");
  const tamperedToken = `${tamperedPayload}.${signature}`;
  assert.equal(verifyReplyToken(tamperedToken), null);
  void encoded;
});

test("SECURITY: a token verified after the signing secret changes is rejected", async () => {
  const originalSecret = process.env.BETTER_AUTH_SECRET;
  const { createReplyToken, verifyReplyToken } = await import("@/lib/email/reply-token");
  const token = createReplyToken({ businessId: "biz-1", conversationId: "conv-1" });

  process.env.BETTER_AUTH_SECRET = "a-completely-different-secret-value-xxxx";
  try {
    assert.equal(verifyReplyToken(token), null);
  } finally {
    process.env.BETTER_AUTH_SECRET = originalSecret;
  }
});

test("verifyReplyToken fails closed (returns null, never throws) for malformed input", async () => {
  const { verifyReplyToken } = await import("@/lib/email/reply-token");
  assert.equal(verifyReplyToken(""), null);
  assert.equal(verifyReplyToken("not-a-token"), null);
  assert.equal(verifyReplyToken("a.b.c"), null);
  assert.equal(verifyReplyToken("###.###"), null);
  assert.doesNotThrow(() => verifyReplyToken("garbage"));
});

test("buildReplyToAddress + extractReplyToken round-trip through the 'reply+<token>@<domain>' convention", async () => {
  const { createReplyToken, buildReplyToAddress, extractReplyToken } = await import("@/lib/email/reply-token");
  const token = createReplyToken({ businessId: "biz-1", conversationId: "conv-1" });
  const address = buildReplyToAddress(token, "reply.example.com");
  assert.equal(address, `reply+${token}@reply.example.com`);
  assert.equal(extractReplyToken(address), token);
});

test("extractReplyToken returns null for an address that doesn't use the reply+ convention (most inbound mail)", async () => {
  const { extractReplyToken } = await import("@/lib/email/reply-token");
  assert.equal(extractReplyToken("hello@example.com"), null);
  assert.equal(extractReplyToken("biz-slug@inbound.example.com"), null);
});

test("extractReplyToken tolerates a mail relay uppercasing the domain (SMTP treats the domain as case-insensitive, unlike the local part)", async () => {
  const { createReplyToken, buildReplyToAddress, extractReplyToken, verifyReplyToken } = await import("@/lib/email/reply-token");
  const token = createReplyToken({ businessId: "biz-1", conversationId: "conv-1" });
  const [local, domain] = buildReplyToAddress(token, "reply.example.com").split("@");
  const address = `${local}@${domain.toUpperCase()}`;
  const extracted = extractReplyToken(address);
  assert.equal(extracted, token);
  assert.deepEqual(verifyReplyToken(extracted), { businessId: "biz-1", conversationId: "conv-1", campaignId: undefined, recipientId: undefined, sendId: undefined });
});

test("KNOWN LIMITATION: a relay that lowercases the entire address (including the token in the local part) breaks verification — real SMTP relays preserve local-part case, but this documents the boundary", async () => {
  const { createReplyToken, buildReplyToAddress, extractReplyToken, verifyReplyToken } = await import("@/lib/email/reply-token");
  const token = createReplyToken({ businessId: "biz-1", conversationId: "conv-1" });
  const address = buildReplyToAddress(token, "reply.example.com").toUpperCase();
  const extracted = extractReplyToken(address);
  assert.equal(verifyReplyToken(extracted), null);
});
